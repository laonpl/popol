// AI PPT 생성 함수 — geminiService.js 에 re-export 됨
import { buildAiPptAnalyzePrompt, buildAiPptRevisePrompt } from '../prompts/portfolioPrompts.js';
import { generateWithRetry } from '../config/geminiClient.js';

// 이 파일에서 필요한 내부 헬퍼들은 geminiService.js 의 것을 쓸 수 없으므로 직접 정의
function parseJSON(text, pattern = /\{[\s\S]*\}/) {
  if (!text) return null;
  const m = text.match(pattern);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function callGeminiPro(prompt) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

function withTimeout(promise, ms = 90000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('AI 응답 시간 초과')), ms)),
  ]);
}

// CP949↔UTF-8 미스매치 산물(Mojibake) 감지·정제.
// Why: 일부 Firestore 문서에 과거 인코딩 손상으로 寃쏀뿕(경험) 같은 잔재가 남아 슬라이드에 노출됨.
// 감지 신호(MOJIBAKE_MARKERS)는 한국어 문서에서 사실상 나타나지 않는 문자만 보수적으로 포함 — 정상 한자/이름은 건드리지 않음.
const MOJIBAKE_MARKERS = /[寃쏀뿕곹됰⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽]/;
function sanitizePortfolioText(value) {
  if (typeof value !== 'string' || !value) return value;
  if (!MOJIBAKE_MARKERS.test(value)) return value;
  return value
    .replace(/[㐀-䶿一-鿿]/g, '')
    .replace(/[寃쏀뿕곹됰⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generateAiPptDeck({ portfolio, templateHint, customTemplate }) {
  const layoutMode = getPptLayoutMode(templateHint);
  const acceptedLayoutDeck = buildAcceptedLayoutDeckFromPortfolio(portfolio, layoutMode);
  if (acceptedLayoutDeck) {
    const safeDeck = sanitizeDeckToPortfolioSource(acceptedLayoutDeck, portfolio);
    return optimizeDeckDensity(safeDeck);
  }

  const orchestrated = orchestrateNotionPortfolioForPpt(portfolio);
  const baseDeck = buildNarrativeFallbackDeck(orchestrated, templateHint);

  try {
    const prompt = buildNotionToPptSystemPrompt({ orchestrated, templateHint, customTemplate, baseDeck });
    const text = await generateWithRetry(prompt, {
      models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
      retries: 2,
      delayMs: 1500,
      callTimeoutMs: 90000,
      config: {
        temperature: 0.35,
        responseMimeType: 'application/json',
      },
    });
    const parsed = parseJSON(text);
    const deck = normalizeNarrativeGeminiDeck(parsed, baseDeck, orchestrated);
    return optimizeDeckDensity(deck);
  } catch (error) {
    console.warn('[AI PPT] Gemini narrative deck generation failed. Falling back to deterministic deck:', error?.message || error);
    return optimizeDeckDensity(baseDeck);
  }
}

/**
 * 결정론적 accepted-layout deck 을 AI 로 "문구만" 서사화한다.
 * 구조(id·layout·proposalVariant·dark·순서)와 사실 필드(metrics·role·period)는 원본 그대로 두고,
 * AI 가 다듬은 산문(title·subtitle·body·bullets·details)만 골라 덮어쓴다.
 * 실패/타임아웃 시 원본 deck 을 그대로 반환(기존 동작 유지).
 */
function cleanText(value, max = 800) {
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return sanitizePortfolioText(value).replace(/\s+/g, ' ').trim().slice(0, max);
  if (Array.isArray(value)) return value.map(v => cleanText(v, max)).filter(Boolean).join(' ').slice(0, max);
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !['id', 'userId', 'createdAt', 'updatedAt'].includes(key))
      .map(([, child]) => cleanText(child, max))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }
  return '';
}

function normalizeSkillNames(list) {
  return (Array.isArray(list) ? list : [])
    .map(item => typeof item === 'string' ? item : (item?.name || item?.title || item?.label || item?.skill || ''))
    .map(item => cleanText(item, 36))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeGoals(goals, valuesEssay) {
  if (Array.isArray(goals)) {
    return goals.map(goal => typeof goal === 'string' ? goal : (goal?.title || goal?.body || goal?.description || goal?.content || ''))
      .map(goal => cleanText(goal, 120))
      .filter(Boolean)
      .slice(0, 4);
  }
  return cleanText(valuesEssay, 360)
    .split(/[.!?。！？\n]+/)
    .map(sentence => cleanText(sentence, 120))
    .filter(Boolean)
    .slice(0, 4);
}

function extractProblemSignals(portfolio, projects) {
  const raw = [
    cleanText(portfolio.yooptaContent, 1200),
    cleanText(portfolio.valuesEssayBlocks, 800),
    cleanText(portfolio.valuesEssay, 600),
    cleanText(portfolio.about, 400),
    ...projects.flatMap(project => [...(project.problem || []), project.body]),
  ].join(' ');
  const sentences = raw
    .split(/[.!?。！？\n]+/)
    .map(sentence => cleanText(sentence, 120))
    .filter(sentence => sentence.length >= 8);
  return Array.from(new Set(sentences)).slice(0, 5);
}

function orchestrateNotionPortfolioForPpt(portfolio = {}) {
  const projects = normalizeExperiences(portfolio).slice(0, 5);
  const primaryProject = projects.find(project => project.metrics?.length || project.problem?.length || project.result?.length) || projects[0] || null;
  const skills = portfolio.skills || {};
  const skillGroups = [
    { label: 'Languages', skills: normalizeSkillNames(skills.languages) },
    { label: 'Frameworks', skills: normalizeSkillNames(skills.frameworks) },
    { label: 'Tools', skills: normalizeSkillNames(skills.tools) },
    { label: 'Others', skills: normalizeSkillNames(skills.others || skills.certificates) },
  ].filter(group => group.skills.length);
  const goals = normalizeGoals(portfolio.goals, portfolio.valuesEssay);
  const target = `${cleanText(portfolio.targetCompany, 40)} ${cleanText(portfolio.targetPosition, 40)}`.trim();
  const userName = cleanText(portfolio.userName || portfolio.name || portfolio.nameKo, 40) || '지원자';
  const headline = cleanText(portfolio.headline || portfolio.title || target, 90);
  const problemSignals = extractProblemSignals(portfolio, projects);

  return {
    profile: {
      userName,
      headline,
      title: cleanText(portfolio.title, 90),
      target,
      contact: portfolio.contact || {},
    },
    intro: {
      positioning: [headline, target].filter(Boolean).join(' · ') || `${userName} 포트폴리오`,
      valueProposition: problemSignals[0] || primaryProject?.body || headline || '문제를 구조화하고 실행으로 증명하는 지원자',
    },
    problem: {
      essence: problemSignals[0] || primaryProject?.problem?.[0] || primaryProject?.body || '',
      signals: problemSignals,
    },
    caseStudy: primaryProject,
    projects,
    skillMap: skillGroups.map(group => ({
      ...group,
      evidence: projects
        .filter(project => group.skills.some(skill => cleanText(project.keywords || []).toLowerCase().includes(skill.toLowerCase()) || cleanText(project.body).toLowerCase().includes(skill.toLowerCase())))
        .map(project => project.heading)
        .slice(0, 2),
    })),
    vision: {
      goals,
      contribution: goals[0] || (target ? `${target}에서 검증 가능한 결과를 만드는 실행 계획` : '학습을 실무 성과로 연결하는 실행 계획'),
    },
  };
}

function buildNotionToPptSystemPrompt({ orchestrated, templateHint, customTemplate, baseDeck }) {
  return `You are a senior full-stack engineer, data architect, career coach, and presentation designer.
You convert Notion-style portfolio data into a professional SlideDeck JSON for pptxgenjs rendering.

Think internally step by step, but output only valid JSON.

Transformation framework:
1. Intro: combine userName and headline into a sharp value proposition.
2. Problem: extract the root discomfort or inefficiency from yooptaContent/problem signals.
3. Deep Dive: choose the strongest project and rewrite it as Situation, Constraint, Decision, Result.
4. Skill Map: group skills by practical usage and connect them to projects.
5. Vision: turn goals into concrete actions for the target company or role.

Constraints:
- Return 7 to 9 slides.
- Each slide must stay under 300 total characters.
- Max 4 bullets or items per slide.
- Convert casual Notion wording into concise business action verbs.
- Do not invent companies, dates, awards, numbers, tools, or metrics.
- Use layoutType on every slide: cover, split, grid, highlight, case-study, skill-map, timeline, closing.
- Use sectionLabel/footer keywords under 20 characters. Never put a full sentence in sectionLabel.
- Prefer visual structure over long prose.

Slide schema:
{
  "meta": { "title": string, "subtitle": string, "theme": "beige-minimal" },
  "slides": [
    {
      "id": "s1",
      "layout": "cover|proposal|experience|skills|values|contact|closing",
      "layoutType": "cover|split|grid|highlight|case-study|skill-map|timeline|closing",
      "proposalVariant": "threeCards|comparison|darkStats|caseGrid|timeline|stageCards|closing",
      "sectionLabel": "20 chars max",
      "title": "slide headline",
      "subtitle": "short supporting line",
      "bullets": ["max 4"],
      "items": [{ "heading": "short", "role": "short", "period": "short", "body": "short", "bullets": ["max 3"], "metrics": [{ "label": "short", "value": "short", "before": "", "after": "" }] }],
      "details": { "problem": ["max 3"], "action": ["max 3"], "result": ["max 3"] },
      "highlight_metric": { "label": "short", "value": "short", "before": "", "after": "" },
      "notes": ""
    }
  ]
}

Preferred base flow:
${JSON.stringify(baseDeck).slice(0, 5000)}

Template hint:
${templateHint || 'standard:beige-minimal'}

Custom template hint:
${customTemplate ? JSON.stringify(customTemplate).slice(0, 1200) : 'none'}

Orchestrated Notion portfolio data:
${JSON.stringify(orchestrated).slice(0, 9000)}

Output valid JSON only.`;
}

function layoutTypeToProposalVariant(layoutType, fallback = 'threeCards') {
  const map = {
    cover: '',
    split: 'comparison',
    grid: 'threeCards',
    highlight: 'darkStats',
    'case-study': 'caseGrid',
    'skill-map': 'caseGrid',
    timeline: 'timeline',
    closing: 'closing',
  };
  return map[layoutType] ?? fallback;
}

function normalizeDeckItem(item = {}) {
  return {
    heading: cleanText(item.heading || item.title, 48),
    period: cleanText(item.period || item.date, 32),
    role: cleanText(item.role || item.label, 42),
    body: cleanText(item.body || item.description || item.content, 110),
    bullets: (Array.isArray(item.bullets) ? item.bullets : [])
      .map(bullet => cleanText(bullet, 70))
      .filter(Boolean)
      .slice(0, 3),
    metrics: (Array.isArray(item.metrics) ? item.metrics : [])
      .map(metric => ({
        label: cleanText(metric?.label, 30),
        value: cleanText(metric?.value, 26),
        before: cleanText(metric?.before, 18),
        after: cleanText(metric?.after, 18),
      }))
      .filter(metric => metric.label || metric.value || metric.before || metric.after)
      .slice(0, 3),
  };
}

function normalizeNarrativeGeminiDeck(parsed, fallbackDeck, orchestrated) {
  const rawSlides = Array.isArray(parsed?.slides) ? parsed.slides : [];
  if (!rawSlides.length) return fallbackDeck;
  const slides = rawSlides.slice(0, 10).map((slide, index) => {
    const layoutType = cleanText(slide.layoutType || slide.visualHint || (index === 0 ? 'cover' : 'grid'), 24);
    const layout = ['cover', 'proposal', 'experience', 'skills', 'values', 'contact', 'closing'].includes(slide.layout)
      ? slide.layout
      : (layoutType === 'cover' ? 'cover' : layoutType === 'closing' ? 'closing' : layoutType === 'case-study' ? 'experience' : 'proposal');
    const proposalVariant = cleanText(slide.proposalVariant || layoutTypeToProposalVariant(layoutType), 32);
    const details = slide.details && typeof slide.details === 'object'
      ? {
        problem: (Array.isArray(slide.details.problem) ? slide.details.problem : []).map(v => cleanText(v, 70)).filter(Boolean).slice(0, 3),
        action: (Array.isArray(slide.details.action) ? slide.details.action : []).map(v => cleanText(v, 70)).filter(Boolean).slice(0, 3),
        result: (Array.isArray(slide.details.result) ? slide.details.result : []).map(v => cleanText(v, 70)).filter(Boolean).slice(0, 3),
      }
      : undefined;
    const highlightMetric = slide.highlight_metric || slide.highlightMetric || null;
    return {
      id: `s${index + 1}`,
      layout,
      layoutType,
      proposalVariant,
      sectionLabel: cleanText(slide.sectionLabel || layoutType, 20),
      title: cleanText(slide.title, 72),
      subtitle: cleanText(slide.subtitle, 96),
      bullets: (Array.isArray(slide.bullets) ? slide.bullets : []).map(bullet => cleanText(bullet, 70)).filter(Boolean).slice(0, 4),
      items: (Array.isArray(slide.items) ? slide.items : []).map(normalizeDeckItem).filter(item => item.heading || item.body).slice(0, 4),
      metrics: (Array.isArray(slide.metrics) ? slide.metrics : []).map(metric => ({
        label: cleanText(metric?.label, 30),
        value: cleanText(metric?.value, 26),
        before: cleanText(metric?.before, 18),
        after: cleanText(metric?.after, 18),
      })).filter(metric => metric.label || metric.value || metric.before || metric.after).slice(0, 4),
      details,
      layout_type: details ? 'SPLIT_HALF' : undefined,
      highlight_metric: highlightMetric ? {
        label: cleanText(highlightMetric.label, 30),
        value: cleanText(highlightMetric.value, 26),
        before: cleanText(highlightMetric.before, 18),
        after: cleanText(highlightMetric.after, 18),
      } : undefined,
      dark: layoutType === 'highlight' || slide.dark === true,
      notes: cleanText(slide.notes, 180),
    };
  });

  if (!slides.some(slide => slide.layout === 'closing')) {
    slides.push(buildNarrativeClosingSlide(orchestrated, `s${slides.length + 1}`));
  }

  return {
    meta: {
      title: cleanText(parsed?.meta?.title || fallbackDeck.meta?.title || orchestrated.intro.positioning, 90),
      subtitle: cleanText(parsed?.meta?.subtitle || fallbackDeck.meta?.subtitle || orchestrated.profile.target, 90),
      theme: 'beige-minimal',
      engine: 'notion-narrative-v2',
    },
    slides,
  };
}

function buildNarrativeClosingSlide(orchestrated, id = 's9') {
  const contact = orchestrated.profile.contact || {};
  const bullets = [
    contact.email && `Email · ${contact.email}`,
    contact.github && `GitHub · ${contact.github}`,
    contact.website && `Web · ${contact.website}`,
    contact.phone && `Phone · ${contact.phone}`,
  ].filter(Boolean).slice(0, 4);
  return {
    id,
    layout: 'closing',
    layoutType: 'closing',
    proposalVariant: 'closing',
    sectionLabel: 'CONTACT',
    title: 'Thank You',
    subtitle: orchestrated.vision.contribution,
    bullets: bullets.length ? bullets : [orchestrated.profile.userName, orchestrated.profile.target].filter(Boolean),
    dark: true,
  };
}

function buildNarrativeFallbackDeck(orchestrated, templateHint) {
  const p = orchestrated;
  const project = p.caseStudy || {};
  const skillItems = p.skillMap.length
    ? p.skillMap.slice(0, 4).map(group => ({
      heading: group.label,
      role: group.evidence?.[0] || 'Project Evidence',
      body: group.evidence?.length ? `${group.skills.slice(0, 4).join(', ')} · ${group.evidence.join(', ')}` : group.skills.slice(0, 5).join(', '),
      bullets: group.skills.slice(0, 4),
      metrics: [],
    }))
    : [{ heading: 'Execution', body: p.intro.valueProposition, bullets: [] }];
  const metric = project.metrics?.[0] || null;
  const slides = [
    {
      id: 's1',
      layout: 'cover',
      layoutType: 'cover',
      sectionLabel: 'INTRO',
      title: p.intro.positioning,
      subtitle: p.intro.valueProposition,
      bullets: ['PROBLEM', 'DECISION', 'IMPACT'],
    },
    {
      id: 's2',
      layout: 'proposal',
      layoutType: 'highlight',
      proposalVariant: 'darkStats',
      sectionLabel: 'PROBLEM',
      title: '해결해야 할 불편함을 먼저 정의했습니다',
      subtitle: p.problem.essence,
      metrics: [
        { label: '핵심 문제', value: p.problem.signals.length ? `${p.problem.signals.length}개` : '1개' },
        { label: '대표 경험', value: p.projects.length ? `${p.projects.length}건` : '정리됨' },
        metric || { label: '검증 지표', value: '경험 기반' },
      ],
      dark: true,
    },
    {
      id: 's3',
      layout: 'experience',
      layoutType: 'case-study',
      proposalVariant: 'caseGrid',
      sectionLabel: 'CASE',
      title: project.heading || '핵심 프로젝트 Deep Dive',
      subtitle: project.role || project.period || p.profile.target,
      layout_type: metric ? 'SPLIT_HALF' : 'STACK_LIST',
      highlight_metric: metric || undefined,
      details: {
        problem: (project.problem?.length ? project.problem : [p.problem.essence]).filter(Boolean).slice(0, 3),
        action: (project.action?.length ? project.action : project.bullets || []).filter(Boolean).slice(0, 3),
        result: (project.result?.length ? project.result : (project.metrics || []).map(m => `${m.label} ${m.value}`)).filter(Boolean).slice(0, 3),
      },
      items: [project].filter(Boolean).map(item => ({
        heading: item.heading,
        period: item.period,
        role: item.role,
        body: item.body,
        bullets: item.bullets || [],
        metrics: item.metrics || [],
      })),
    },
    {
      id: 's4',
      layout: 'proposal',
      layoutType: 'grid',
      proposalVariant: 'threeCards',
      sectionLabel: 'DECISION',
      title: '의사결정은 실행 근거로 설명합니다',
      subtitle: '상황, 제약, 선택 기준을 분리해 설득력을 만듭니다',
      items: [
        { heading: 'Situation', body: project.problem?.[0] || p.problem.essence },
        { heading: 'Constraint', body: project.body || project.role || '제한된 조건에서 우선순위를 정리' },
        { heading: 'Decision', body: project.action?.[0] || project.bullets?.[0] || '실행 가능한 단위로 해결책 선택' },
      ],
    },
    {
      id: 's5',
      layout: 'skills',
      layoutType: 'skill-map',
      proposalVariant: 'caseGrid',
      sectionLabel: 'SKILLS',
      title: '기술은 프로젝트 연결 고리로 보여줍니다',
      subtitle: '단순 나열이 아니라 활용 맥락 중심으로 재그룹화했습니다',
      items: skillItems,
    },
    {
      id: 's6',
      layout: 'proposal',
      layoutType: 'timeline',
      proposalVariant: 'timeline',
      sectionLabel: 'GROWTH',
      title: '경험은 다음 기여 계획으로 이어집니다',
      subtitle: p.vision.contribution,
      items: (p.vision.goals.length ? p.vision.goals : ['문제 정의', '빠른 실행', '성과 측정', '반복 개선'])
        .slice(0, 4)
        .map((goal, index) => ({ heading: goal, period: `Step ${index + 1}`, body: index === 0 ? p.profile.target : p.intro.valueProposition })),
    },
    buildNarrativeClosingSlide(p, 's7'),
  ];
  return {
    meta: {
      title: p.intro.positioning,
      subtitle: p.profile.target,
      theme: templateHint || 'beige-minimal',
      engine: 'notion-narrative-v2-fallback',
    },
    slides,
  };
}

const SLIDE_TEXT_LIMIT = 300;
const SHORT_TEXT_LIMIT = 50;
const BODY_TEXT_LIMIT = 95;
const DETAIL_TEXT_LIMIT = 70;

function compactSlideText(value, max = SHORT_TEXT_LIMIT) {
  const text = sanitizePortfolioText(String(value || ''))
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const sentence = text
    .split(/(?<=[.!?。！？])\s+|[。！？.!?]\s*/)
    .map(s => s.trim())
    .find(s => s && s.length <= max);
  return sentence || `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function slideTextLength(slide = {}) {
  const parts = [
    slide.title,
    slide.subtitle,
    ...(Array.isArray(slide.bullets) ? slide.bullets : []),
    ...(Array.isArray(slide.items) ? slide.items.flatMap(item => [
      item.heading,
      item.role,
      item.period,
      item.body,
      ...(Array.isArray(item.bullets) ? item.bullets : []),
      ...(Array.isArray(item.metrics) ? item.metrics.flatMap(m => [m.label, m.value, m.before, m.after]) : []),
    ]) : []),
    ...(slide.details ? [
      ...(Array.isArray(slide.details.problem) ? slide.details.problem : []),
      ...(Array.isArray(slide.details.action) ? slide.details.action : []),
      ...(Array.isArray(slide.details.result) ? slide.details.result : []),
    ] : []),
  ];
  return parts.filter(Boolean).join(' ').length;
}

function optimizeSlideContent(slide = {}) {
  const optimized = {
    ...slide,
    sectionLabel: compactSlideText(slide.sectionLabel || slide.layout || '', 20),
    title: compactSlideText(slide.title, 64),
    subtitle: compactSlideText(slide.subtitle, 82),
  };
  if (Array.isArray(slide.bullets)) {
    optimized.bullets = slide.bullets
      .map(b => compactSlideText(b, SHORT_TEXT_LIMIT))
      .filter(Boolean)
      .slice(0, 4);
  }
  if (Array.isArray(slide.items)) {
    optimized.items = slide.items.slice(0, 4).map(item => ({
      ...item,
      heading: compactSlideText(item.heading, 42),
      period: compactSlideText(item.period, 28),
      role: compactSlideText(item.role, 36),
      body: compactSlideText(item.body, BODY_TEXT_LIMIT),
      bullets: Array.isArray(item.bullets)
        ? item.bullets.map(b => compactSlideText(b, DETAIL_TEXT_LIMIT)).filter(Boolean).slice(0, 3)
        : [],
      metrics: Array.isArray(item.metrics)
        ? item.metrics.slice(0, 3).map(metric => ({
          ...metric,
          label: compactSlideText(metric.label, 28),
          value: compactSlideText(metric.value, 24),
          before: compactSlideText(metric.before, 18),
          after: compactSlideText(metric.after, 18),
        })).filter(metric => metric.label || metric.value || metric.before || metric.after)
        : [],
    }));
  }
  if (slide.details && typeof slide.details === 'object') {
    optimized.details = {
      problem: (Array.isArray(slide.details.problem) ? slide.details.problem : [])
        .map(v => compactSlideText(v, DETAIL_TEXT_LIMIT)).filter(Boolean).slice(0, 3),
      action: (Array.isArray(slide.details.action) ? slide.details.action : [])
        .map(v => compactSlideText(v, DETAIL_TEXT_LIMIT)).filter(Boolean).slice(0, 3),
      result: (Array.isArray(slide.details.result) ? slide.details.result : [])
        .map(v => compactSlideText(v, DETAIL_TEXT_LIMIT)).filter(Boolean).slice(0, 3),
    };
  }
  optimized.density = {
    chars: slideTextLength(optimized),
    limit: SLIDE_TEXT_LIMIT,
  };
  return optimized;
}

function splitDenseSlide(slide = {}) {
  const isStructural = ['cover', 'closing', 'section'].includes(slide.layout) || slide.proposalVariant === 'contents';
  const needsItemSplit = Array.isArray(slide.items) && slide.items.length > 4;
  const needsBulletSplit = Array.isArray(slide.bullets) && slide.bullets.length > 4;
  if (isStructural || (!needsItemSplit && !needsBulletSplit && slideTextLength(slide) <= SLIDE_TEXT_LIMIT)) return [slide];

  if (needsItemSplit) {
    const chunks = [];
    for (let i = 0; i < slide.items.length; i += 4) chunks.push(slide.items.slice(i, i + 4));
    return chunks.map((items, index) => ({
      ...slide,
      id: `${slide.id || 'slide'}_${index + 1}`,
      title: `${slide.title || ''} (${index + 1}/${chunks.length})`,
      items,
      notes: [slide.notes, 'autoSplit:true'].filter(Boolean).join(' '),
    }));
  }

  if (needsBulletSplit) {
    const chunks = [];
    for (let i = 0; i < slide.bullets.length; i += 4) chunks.push(slide.bullets.slice(i, i + 4));
    return chunks.map((bullets, index) => ({
      ...slide,
      id: `${slide.id || 'slide'}_${index + 1}`,
      title: `${slide.title || ''} (${index + 1}/${chunks.length})`,
      bullets,
      notes: [slide.notes, 'autoSplit:true'].filter(Boolean).join(' '),
    }));
  }

  return [{ ...slide, notes: [slide.notes, 'summarizedForDensity:true'].filter(Boolean).join(' ') }];
}

function optimizeDeckDensity(deck) {
  if (!deck || !Array.isArray(deck.slides)) return deck;
  // 합격형 reference deck(narrative/star/kpi/timeline/case-study)은 고정 레이아웃 + 자체 truncation 을 쓴다.
  // splitDenseSlide 가 keyword bullets>4·items>4 슬라이드를 쪼개면서 OVERVIEW/제목이 (1/3)(2/3)... 중복 생성되는 문제 방지.
  if (typeof deck.meta?.templateMode === 'string' && deck.meta.templateMode.startsWith('accepted-')) {
    return deck;
  }
  const slides = deck.slides
    .flatMap(splitDenseSlide)
    .map(optimizeSlideContent)
    .map((slide, index) => ({ ...slide, id: `s${index + 1}` }));
  return {
    ...deck,
    meta: {
      ...(deck.meta || {}),
      densityPolicy: {
        maxCharsPerSlide: SLIDE_TEXT_LIMIT,
        maxBulletsOrItems: 4,
        maxSentenceChars: SHORT_TEXT_LIMIT,
      },
    },
    slides,
  };
}

function sanitizeDeckToPortfolioSource(deck, portfolio) {
  if (!deck || !Array.isArray(deck.slides)) return deck;
  const source = buildPortfolioSourceIndex(portfolio);
  const cleanText = (value, max = 220) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (isPortfolioSourceBound(text, source)) return text.slice(0, max);
    return '';
  };
  const cleanMetric = (metric = {}) => {
    const label = cleanText(metric.label, 60);
    const value = cleanText(metric.value, 80);
    const before = cleanText(metric.before, 60);
    const after = cleanText(metric.after, 60);
    if (!label && !value && !before && !after) return null;
    return { ...metric, label, value, before, after };
  };
  const cleanItem = (item = {}) => {
    const rawHeading = String(item.heading || '').trim();
    const heading = cleanText(rawHeading, 80) || (rawHeading.length <= 12 ? rawHeading.slice(0, 80) : '');
    const period = cleanText(item.period, 50);
    const role = cleanText(item.role, 60);
    const body = cleanText(item.body, 220);
    const bullets = Array.isArray(item.bullets) ? item.bullets.map(b => cleanText(b, 160)).filter(Boolean) : [];
    const metrics = Array.isArray(item.metrics) ? item.metrics.map(cleanMetric).filter(Boolean) : [];
    return { ...item, heading, period, role, body, bullets, metrics };
  };
  return {
    ...deck,
    slides: deck.slides.map(slide => ({
      ...slide,
      subtitle: cleanText(slide.subtitle, 160),
      bullets: Array.isArray(slide.bullets) ? slide.bullets.map(b => cleanText(b, 160)).filter(Boolean) : slide.bullets,
      items: Array.isArray(slide.items) ? slide.items.map(cleanItem) : slide.items,
      metrics: Array.isArray(slide.metrics) ? slide.metrics.map(cleanMetric).filter(Boolean) : slide.metrics,
      table: Array.isArray(slide.table)
        ? slide.table.map((row, rowIndex) => Array.isArray(row)
          ? row.map(cell => rowIndex === 0 ? String(cell || '').slice(0, 60) : cleanText(cell, 120))
          : row)
        : slide.table,
      notes: cleanText(slide.notes, 300),
    })),
  };
}

function buildPortfolioSourceIndex(portfolio) {
  const chunks = [];
  const visit = (value) => {
    if (value == null) return;
    if (typeof value === 'string' || typeof value === 'number') {
      chunks.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([key, child]) => {
        if (['id', 'userId', 'createdAt', 'updatedAt', 'template', 'thumbnail'].includes(key)) return;
        visit(child);
      });
    }
  };
  visit(portfolio);
  const text = chunks.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const tokens = new Set((text.match(/[a-z0-9가-힣]{2,}/gi) || []).map(t => t.toLowerCase()));
  const numbers = new Set((text.match(/\d+(?:[.,]\d+)?%?/g) || []).map(t => t.replace(/,/g, '')));
  return { text, tokens, numbers };
}

function isPortfolioSourceBound(text, source) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.length <= 12) return true;
  if (!source.text) return false;
  if (source.text.includes(normalized)) return true;

  // 수치 허위 차단(핵심 가드): 텍스트에 숫자가 있는데 원문에 그 숫자가 하나도 없으면 버림.
  const textNumbers = (normalized.match(/\d+(?:[.,]\d+)?%?/g) || []).map(t => t.replace(/,/g, ''));
  if (textNumbers.length && !textNumbers.some(n => source.numbers.has(n))) return false;

  // 토큰 매칭: 원문 토큰과 충분히 겹쳐야 통과 (긴 문장일수록 더 엄격) → 지어낸 내용 차단.
  const tokens = (normalized.match(/[a-z0-9가-힣]{2,}/gi) || []).map(t => t.toLowerCase());
  if (!tokens.length) return normalized.length <= 30;
  const meaningful = tokens.filter(t => !SOURCE_STOPWORDS.has(t));
  const compareTokens = meaningful.length ? meaningful : tokens;
  const hits = compareTokens.filter(t => source.tokens.has(t) || source.text.includes(t));
  const required = normalized.length > 45 ? 2 : 1;
  return hits.length >= Math.min(required, compareTokens.length);
}

const SOURCE_STOPWORDS = new Set([
  'portfolio', 'project', 'experience', 'skill', 'skills', 'role', 'result', 'action',
  'before', 'after', 'week', 'phase', 'core', 'fit', 'growth', 'impact', 'evidence',
]);

function getPptLayoutMode(templateHint) {
  const hint = String(templateHint || '').toLowerCase().trim();
  if (!hint) return 'standard';
  const [layout] = hint.split(':');
  const known = ['standard', 'narrative', 'star', 'kpi-dashboard', 'timeline', 'case-study'];
  return known.includes(layout) ? layout : 'standard';
}

function isProposalTemplateHint(templateHint) {
  const hint = String(templateHint || '').toLowerCase().trim();
  if (!hint) return false;
  const layoutMode = getPptLayoutMode(hint);
  return layoutMode === 'standard' || hint === 'proposal' || hint.includes('1번') || hint.includes('template-1');
}

export async function reviseAiPptSlide({ slide, instruction, portfolio }) {
  const prompt = buildAiPptRevisePrompt({ slide, instruction, portfolio });
  const text = await withTimeout(callGeminiPro(prompt), 60000);
  const parsed = parseJSON(text) || {};
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

function buildProposalDeckFromPortfolio(p) {
  const slides = [];
  const userName = sanitizePortfolioText(p.userName) || '지원자';
  const targetCompany = sanitizePortfolioText(p.targetCompany) || '';
  const targetPosition = sanitizePortfolioText(p.targetPosition) || '';
  const target = `${targetCompany} ${targetPosition}`.trim();
  const experiences = normalizeExperiences(p).slice(0, 4);
  const primary = experiences[0] || {};
  const allMetrics = experiences.flatMap(e => e.metrics || []).filter(m => m.label || m.value).slice(0, 6);
  const firstMetric = allMetrics[0] || null;
  const metricText = (m) => m ? (m.before && m.after ? `${m.before} → ${m.after}` : (m.value || '성과')) : '성과 달성';
  const keywordSet = new Set();
  experiences.forEach(e => (e.keywords || []).slice(0, 4).forEach(k => keywordSet.add(String(k).trim())));
  const keywords = Array.from(keywordSet).filter(Boolean).slice(0, 8);
  const strengths = deriveStrengths(experiences, p);
  const contactBullets = [p.contact?.email && `Email · ${p.contact.email}`, p.contact?.phone && `Phone · ${p.contact.phone}`, p.contact?.website && `Web · ${p.contact.website}`].filter(Boolean);
  const allBullets = experiences.flatMap(e => e.bullets || []).filter(Boolean);

  // ═══════════════════════════════════════════════════
  // SLIDE 1: Cover
  // ═══════════════════════════════════════════════════
  slides.push({
    id: 's1',
    layout: 'cover',
    title: target ? `${target} 지원 포트폴리오` : `${userName} 포트폴리오`,
    subtitle: `${userName}이(가) 직접 정리한 경험 기반 자료입니다`,
    bullets: ['EXPERIENCE', 'PERFORMANCE', 'FIT'],
  });

  // ═══════════════════════════════════════════════════
  // SLIDE 2: 목차 — 4챕터 구조
  // ═══════════════════════════════════════════════════
  slides.push({
    id: 's2',
    layout: 'proposal',
    sectionLabel: '목차',
    proposalVariant: 'contents',
    title: '목차',
    items: [
      { heading: '01  지원자 소개', role: 'Introduction', body: `${userName}의 역량과 성장 흐름` },
      { heading: '02  핵심 경험', role: 'Key Experience', body: `${experiences.length || 1}건의 대표 경험과 성과 증거` },
      { heading: '03  직무 적합성', role: 'Job Fit', body: targetPosition ? `${targetPosition} 요구와 연결되는 강점` : '지원 직무와 연결되는 강점' },
      { heading: '04  성장 계획', role: 'Growth Plan', body: '입사 후 기여 방향과 단계별 실행 계획' },
    ],
  });

  // ═══════════════════════════════════════════════════
  // Chapter 1: 지원자 소개
  // ═══════════════════════════════════════════════════

  // SLIDE 3: 3가지 핵심 강점
  slides.push({
    id: 's3',
    layout: 'proposal',
    sectionLabel: '지원자 소개',
    proposalVariant: 'threeCards',
    title: `${userName}을(를) 한 문장으로 설명하면 이렇습니다`,
    subtitle: '지원 직무에서 가장 필요한 역량을 실제 경험으로 보여드립니다',
    items: [
      {
        heading: primary.role || (strengths[0] ? strengths[0].split('·')[0].trim() : '실행력'),
        body: primary.body || primary.bullets?.[0] || '문제를 직접 찾아 구조화하고 해결하는 방식으로 일해왔습니다',
      },
      {
        heading: experiences[1]?.heading || (strengths[1] ? strengths[1].split('·')[0].trim() : '협업과 소통'),
        body: experiences[1]?.body || experiences[1]?.bullets?.[0] || '팀 안에서 구체적인 역할을 맡아 함께 성과를 만들었습니다',
      },
      {
        heading: firstMetric?.label || keywords[0] || '성장 지향',
        body: firstMetric ? `${metricText(firstMetric)}의 성과를 경험했습니다` : (keywords.join(', ') || '경험을 통해 지속적으로 배우고 성장합니다'),
      },
    ],
  });

  // SLIDE 4: 경험 타임라인
  slides.push({
    id: 's4',
    layout: 'proposal',
    sectionLabel: '지원자 소개',
    proposalVariant: 'timeline',
    title: `${userName}의 경험이 이어져 온 흐름입니다`,
    subtitle: '주요 경험이 어떻게 쌓이고 성장해왔는지 시간 순서로 보여드립니다',
    items: experiences.length
      ? experiences.map(e => ({ heading: e.heading, period: e.period || e.role, body: e.body || e.bullets?.[0] || '' }))
      : [{ heading: '경험 추가 예정', period: '—', body: '경험 정리 후 자동으로 채워집니다' }],
  });

  // SLIDE 5: 핵심 지표 (darkStats)
  slides.push({
    id: 's5',
    layout: 'proposal',
    sectionLabel: '지원자 소개',
    proposalVariant: 'darkStats',
    dark: true,
    title: `${userName}의 경험이 만든 성과입니다`,
    subtitle: '수행한 경험에서 직접 확인된 수치와 역할을 핵심 지표로 제시합니다',
    metrics: [
      { label: '수행 경험 수', value: `${experiences.length || 1}건` },
      ...(allMetrics.slice(0, 2).map(m => ({ label: m.label || '성과 지표', value: metricText(m) }))),
      { label: '핵심 역량 키워드', value: `${keywords.length || strengths.length || 3}+` },
    ].slice(0, 4),
  });

  // ═══════════════════════════════════════════════════
  // Chapter 2: 핵심 경험
  // ═══════════════════════════════════════════════════

  if (experiences.length === 0) {
    slides.push({
      id: 's6',
      layout: 'proposal',
      sectionLabel: '핵심 경험',
      proposalVariant: 'splitPhotoList',
      title: '지원 직무와 연결되는 경험을 소개합니다',
      subtitle: '경험 정리 내용이 등록되면 이 슬라이드에 자동으로 구성됩니다',
      items: [
        { heading: '상황과 문제', body: '어떤 맥락에서 어떤 문제를 마주했는지 설명합니다' },
        { heading: '실행한 방법', body: '구체적으로 어떻게 접근하고 행동했는지 보여줍니다' },
        { heading: '결과와 배움', body: '어떤 성과가 나왔고 무엇을 배웠는지 정리합니다' },
      ],
    });
  } else {
    // 경험 전체 개요
    slides.push({
      id: 's6',
      layout: 'proposal',
      sectionLabel: '핵심 경험',
      proposalVariant: 'splitPhotoList',
      title: `${userName}의 대표 경험을 소개합니다`,
      subtitle: '직무와 연결되는 경험을 역할·성과 중심으로 정리했습니다',
      items: experiences.slice(0, 3).map(e => ({
        heading: e.heading,
        role: e.role || e.period,
        body: e.body || e.bullets?.[0] || '',
      })),
    });

    // 경험별 상세 슬라이드 (최대 3개)
    experiences.slice(0, 3).forEach((e, i) => {
      const problemText = e.problem?.[0] || e.body || '';
      const actionText = e.action?.[0] || e.bullets?.[1] || e.bullets?.[0] || '';
      const resultText = e.result?.[0] || (e.metrics?.[0] ? `${e.metrics[0].label}: ${metricText(e.metrics[0])}` : e.bullets?.[2] || '');
      const detailItems = [
        { heading: '상황과 문제', body: problemText || '해결이 필요한 문제를 정의하고 맥락을 파악했습니다' },
        { heading: '실행한 방법', body: actionText || '구체적인 방법으로 문제에 접근하고 실행했습니다' },
        { heading: '결과와 성과', body: resultText || '수행 결과와 그 과정에서 얻은 배움을 정리했습니다' },
      ];
      if (e.metrics?.[0]) {
        detailItems.push({ heading: '핵심 지표', body: `${e.metrics[0].label || '성과'}: ${metricText(e.metrics[0])}` });
      }
      slides.push({
        id: `s${slides.length + 1}`,
        layout: 'proposal',
        sectionLabel: '핵심 경험',
        proposalVariant: 'stairSteps',
        title: `${e.heading}에서 보여준 과정입니다`,
        subtitle: [e.role, e.period].filter(Boolean).join(' · ') || e.heading,
        items: detailItems.slice(0, 4),
      });
    });
  }

  // ═══════════════════════════════════════════════════
  // Chapter 3: 직무 적합성
  // ═══════════════════════════════════════════════════

  // 벤다이어그램 — 라벨을 회사명이 아닌 의미 있는 텍스트로 고정
  slides.push({
    id: `s${slides.length + 1}`,
    layout: 'proposal',
    sectionLabel: '직무 적합성',
    proposalVariant: 'venn',
    title: '제 강점과 직무 요구가 만나는 지점입니다',
    subtitle: '보유 역량과 지원 직무의 요구사항이 겹치는 핵심 포인트를 설명합니다',
    items: [
      {
        heading: `${userName}의 강점`,
        body: primary.role ? `${primary.role} 역할 기반의 실행 경험` : (strengths[0] || '문제 해결 중심의 실행 경험'),
      },
      {
        heading: targetPosition ? `${targetPosition} 요구` : '직무 요구',
        body: target ? `${target}에서 필요로 하는 역량과 역할` : '지원 직무에서 필요로 하는 역량과 역할',
      },
      {
        heading: '연결 포인트',
        body: firstMetric
          ? `${firstMetric.label} 기반 성과 증명 (${metricText(firstMetric)})`
          : (primary.bullets?.[0] || allBullets[0] || '경험에서 검증된 역량이 직무 요구와 일치합니다'),
      },
    ],
  });

  // 역량 바 — 실제 경험 bullets 사용
  slides.push({
    id: `s${slides.length + 1}`,
    layout: 'proposal',
    sectionLabel: '직무 적합성',
    proposalVariant: 'metricBars',
    title: '경험에서 반복 확인된 직무 연결 역량입니다',
    subtitle: '실제 수행 과정에서 검증된 역량과 지원 직무 요구사항의 연결점입니다',
    bullets: allBullets.length >= 4
      ? allBullets.slice(0, 5)
      : [
          ...allBullets,
          ...strengths.filter(s => !allBullets.includes(s)),
        ].slice(0, 5),
  });

  // 기여 가치 — conditionGrid
  slides.push({
    id: `s${slides.length + 1}`,
    layout: 'proposal',
    sectionLabel: '직무 적합성',
    proposalVariant: 'conditionGrid',
    title: `${targetPosition || target || '지원 직무'}에서 기여할 수 있는 가치입니다`,
    subtitle: '경험에서 확인된 역량을 실제 직무 기여 방식으로 연결합니다',
    items: [
      {
        heading: primary.heading || '대표 경험 적용',
        body: primary.body || primary.bullets?.[0] || '핵심 경험에서 쌓은 실행력을 즉시 적용합니다',
      },
      {
        heading: experiences[1]?.heading || '협업 경험',
        body: experiences[1]?.body || experiences[1]?.bullets?.[0] || '팀 안에서 역할을 명확히 하며 협업합니다',
      },
      {
        heading: firstMetric?.label || '성과 창출',
        body: firstMetric
          ? `${metricText(firstMetric)}의 성과를 만들어온 방식으로 기여합니다`
          : '측정 가능한 목표를 설정하고 결과로 증명합니다',
      },
      {
        heading: strengths[0] ? strengths[0].split('·')[0].trim() : '지속 성장',
        body: strengths[1] || '경험에서 배운 것을 다음 과제에 적용하며 성장합니다',
      },
    ],
  });

  // ═══════════════════════════════════════════════════
  // Chapter 4: 성장 계획
  // ═══════════════════════════════════════════════════

  // 단계별 기여 계획 (gantt)
  slides.push({
    id: `s${slides.length + 1}`,
    layout: 'proposal',
    sectionLabel: '성장 계획',
    proposalVariant: 'gantt',
    title: '입사 후 단계별 기여 계획입니다',
    subtitle: '경험을 바탕으로 빠르게 적응하고 실질적인 기여를 만들어 나가겠습니다',
    items: [
      {
        heading: '업무 이해 및 적응',
        role: '1~2주',
        body: '팀 문화와 업무 방식을 파악하고 즉시 활용 가능한 역량을 연결합니다',
      },
      {
        heading: '초기 기여 시작',
        role: '3~4주',
        body: primary.heading
          ? `${primary.heading} 경험을 기반으로 실무에 기여를 시작합니다`
          : '가장 자신 있는 영역부터 구체적인 기여를 시작합니다',
      },
      {
        heading: '핵심 역할 수행',
        role: '2~3개월',
        body: firstMetric
          ? `${firstMetric.label} 수준의 성과를 목표로 핵심 과제를 수행합니다`
          : '팀의 핵심 과제에 온전히 기여하며 성과를 만들어냅니다',
      },
      {
        heading: '성과 검토 및 확장',
        role: '3개월 이후',
        body: '초기 성과를 점검하고 다음 단계의 기여 영역을 확장합니다',
      },
    ],
  });

  // 약속 (promise)
  slides.push({
    id: `s${slides.length + 1}`,
    layout: 'proposal',
    sectionLabel: '성장 계획',
    proposalVariant: 'promise',
    title: '이 경험을 바탕으로 확실히 기여하겠습니다',
    subtitle: '검증된 실행력과 성장 의지로 지속 가능한 성과를 만들어가겠습니다',
    bullets: [
      `${primary.heading || '핵심 경험'}에서 확인한 실행 방식을 즉시 적용하겠습니다`,
      firstMetric
        ? `${firstMetric.label} 수준의 성과를 목표 기준으로 삼겠습니다`
        : '측정 가능한 목표를 설정하고 결과로 증명하겠습니다',
      strengths[0] || '팀과 함께 빠르게 적응하며 역할을 확장하겠습니다',
    ],
  });

  // ═══════════════════════════════════════════════════
  // 마무리 (Closing)
  // ═══════════════════════════════════════════════════
  slides.push({
    id: `s${slides.length + 1}`,
    layout: 'closing',
    proposalVariant: 'closing',
    dark: true,
    sectionLabel: '마무리',
    title: 'Thank You',
    subtitle: target
      ? `${userName}이(가) ${target}에 기여하겠습니다.`
      : `${userName}이(가) 귀사에 기여하겠습니다.`,
    bullets: contactBullets.length ? contactBullets : ['경험 기반 포트폴리오 · 직접 정리한 자료입니다'],
  });

  return finalizeAcceptedDeck({
    title: target ? `${userName} · ${target} 포트폴리오` : `${userName} 포트폴리오`,
    subtitle: target,
    accentColor: '#FF4F1A',
    templateMode: 'proposal-v2',
  }, slides, buildDeckContext(p), 'proposal');
}

function buildAcceptedLayoutDeckFromPortfolio(p, layoutMode) {
  if (layoutMode === 'narrative') return buildNarrativeDeckFromPortfolio(p);
  if (layoutMode === 'star') return buildStarDeckFromPortfolio(p);
  if (layoutMode === 'kpi-dashboard') return buildKpiDashboardDeckFromPortfolio(p);
  if (layoutMode === 'timeline') return buildTimelineDeckFromPortfolio(p);
  if (layoutMode === 'case-study') return buildCaseStudyDeckFromPortfolio(p);
  return null;
}

function buildDeckContext(p) {
  const userName = sanitizePortfolioText(p.userName || p.name || p.nameKo) || '지원자';
  const target = `${sanitizePortfolioText(p.targetCompany) || ''} ${sanitizePortfolioText(p.targetPosition) || ''}`.trim() || sanitizePortfolioText(p.headline) || sanitizePortfolioText(p.title) || '';
  const experiences = normalizeExperiences(p).slice(0, 6);
  const expItems = experiences.length ? experiences : [{
    heading: '대표 경험',
    role: target || '지원 직무',
    period: '',
    body: '경험 정리 내용이 입력되면 핵심 문제, 실행 과정, 성과가 자동으로 구성됩니다.',
    bullets: ['문제 정의', '해결 과정', '성과 정리'],
    metrics: [],
    problem: ['해결해야 할 문제를 명확히 정의'],
    action: ['실행한 방식과 역할을 구체화'],
    result: ['결과와 배운 점을 증거로 정리'],
  }];
  const primary = expItems[0] || {};
  const allMetrics = expItems.flatMap(e => e.metrics || []).filter(m => m.label || m.value);
  const metricText = (m) => m?.before && m?.after ? `${m.before} → ${m.after}` : (m?.value || '성과');
  const firstMetric = allMetrics[0] || { label: '대표 성과', value: `${expItems.length}+`, before: '', after: '' };
  const keywordSet = new Set();
  expItems.forEach(e => (e.keywords || []).slice(0, 4).forEach(k => keywordSet.add(String(k).trim())));
  const keywords = Array.from(keywordSet).filter(Boolean).slice(0, 8);
  const strengths = deriveStrengths(expItems, p);
  const contactBullets = [
    p.contact?.email && `Email · ${p.contact.email}`,
    p.contact?.phone && `Phone · ${p.contact.phone}`,
    p.contact?.github && `GitHub · ${p.contact.github}`,
    p.contact?.website && `Web · ${p.contact.website}`,
    p.contact?.linkedin && `LinkedIn · ${p.contact.linkedin}`,
    p.contact?.instagram && `Instagram · ${p.contact.instagram}`,
  ].filter(Boolean);
  const pickBullets = (fallback = []) => {
    const fromExp = expItems.flatMap(e => e.bullets || []).filter(Boolean);
    return (fromExp.length ? fromExp : fallback).slice(0, 6);
  };
  const expAt = (index) => expItems[index % expItems.length] || expItems[0] || {};
  const expPoint = (index, fallback) => {
    const e = expAt(index);
    return e.bullets?.[0] || e.body || fallback;
  };
  const metricPool = [
    ...allMetrics,
    { label: '대표 사례', value: `${expItems.length}+` },
    { label: '직무 연결성', value: target ? '맞춤형' : '확장형' },
    { label: '핵심 키워드', value: `${keywords.length || strengths.length || 3}+` },
  ].slice(0, 6);

  return { portfolio: p, userName, target, experiences, expItems, primary, allMetrics, firstMetric, metricText, keywords, strengths, contactBullets, pickBullets, expAt, expPoint, metricPool };
}

function buildClosingSlide(ctx, id = 's99') {
  return {
    id,
    layout: 'closing',
    proposalVariant: 'closing',
    dark: true,
    sectionLabel: '마무리',
    title: 'Thank You',
    subtitle: `${ctx.userName}의 경험이 ${ctx.target || '다음 기회'}에 기여하겠습니다.`,
    bullets: ctx.contactBullets.length ? ctx.contactBullets : ['경험 기반 포트폴리오', '문제 해결', '성과 증명'],
  };
}

function makeExperienceSlide(id, sectionLabel, title, e, subtitle = '') {
  const details = {
    problem: (e.problem?.length ? e.problem : [e.body || '해결해야 할 문제와 맥락을 정의']).slice(0, 3),
    action: (e.action?.length ? e.action : (e.bullets || []).slice(0, 3)).slice(0, 3),
    result: (e.result?.length ? e.result : (e.metrics || []).map(m => `${m.label || '성과'} ${m.value || ''}`.trim()).filter(Boolean)).slice(0, 3),
  };
  const totalLen = [...details.problem, ...details.action, ...details.result].join(' ').length;
  const highlight_metric = (e.metrics || [])[0] || null;
  const layout_type = highlight_metric && totalLen < 90 ? 'CENTER_METRIC' : highlight_metric ? 'SPLIT_HALF' : 'STACK_LIST';
  return {
    id,
    layout: 'experience',
    sectionLabel,
    title,
    subtitle: subtitle || e.role || e.period || '',
    layout_type,
    dark: layout_type === 'CENTER_METRIC',
    highlight_metric,
    details,
    items: [{ heading: e.heading, period: e.period, role: e.role, body: e.body, bullets: e.bullets || [], metrics: e.metrics || [] }],
  };
}

function buildNarrativeDeckFromPortfolio(p) {
  const ctx = buildDeckContext(p);
  const { userName, target, expItems, primary, firstMetric, metricText, strengths, pickBullets, expAt, expPoint } = ctx;
  const slides = [
    { id: 's1', layout: 'cover', title: `${userName} 성장 스토리`, subtitle: target ? `${target}에 맞춘 문제 해결 여정` : '문제 발견부터 성과까지 이어지는 포트폴리오', bullets: ['CONTEXT', 'TURNING POINT', 'IMPACT'] },
    { id: 's2', layout: 'proposal', sectionLabel: '목차', proposalVariant: 'contents', title: '스토리 흐름', items: [
      { heading: '한 줄 포지셔닝', role: 'Hook', body: '지원 직무와 맞닿은 핵심 메시지' },
      { heading: '문제의 시작', role: 'Context', body: '왜 이 경험이 중요한지 설명' },
      { heading: '전환점', role: 'Action', body: '판단과 실행의 근거' },
      { heading: '성과 증거', role: 'Proof', body: '결과와 배운 점을 수치로 제시' },
      { heading: '다음 기여', role: 'Next', body: '입사 후 확장 가능성' },
    ] },
    { id: 's3', layout: 'proposal', sectionLabel: '포지셔닝', proposalVariant: 'darkStats', dark: true, title: target ? `${target}에서 바로 읽히는 강점입니다` : '처음 6초에 보여줄 핵심 강점입니다', subtitle: '합격 포트폴리오는 자기소개보다 역할·성과·근거를 먼저 보여줍니다', metrics: [
      { label: '대표 경험', value: `${expItems.length}+` },
      { label: firstMetric.label || '대표 성과', value: metricText(firstMetric) },
      { label: '핵심 강점', value: `${strengths.length || 3}+` },
      { label: '지원 방향', value: target ? '맞춤형' : '직무형' },
    ] },
    { id: 's4', layout: 'proposal', sectionLabel: '문제의 시작', proposalVariant: 'comparison', title: '문제는 이렇게 발견했습니다', subtitle: '좋은 스토리형 포트폴리오는 상황 설명보다 갈등과 기준을 먼저 보여줍니다', items: [
      { heading: 'Before', body: primary.problem?.[0] || primary.body || '초기에는 해결 기준과 우선순위가 불명확했습니다' },
      { heading: 'After', body: primary.action?.[0] || expPoint(0, '문제를 쪼개고 실행 기준을 세워 결과로 연결했습니다') },
    ] },
    { id: 's5', layout: 'proposal', sectionLabel: '전환점', proposalVariant: 'timeline', title: '경험은 이렇게 누적되었습니다', subtitle: '각 경험이 다음 경험의 판단 기준으로 이어지는 구조입니다', items: expItems.slice(0, 5).map(e => ({ heading: e.heading, period: e.period || e.role, body: e.body || e.bullets?.[0] || '' })) },
    // 경험 수만큼 슬라이드 생성 — expAt(0)/expAt(1) 고정 대신 expItems 전체 순회
    ...expItems.slice(0, 5).map((e, idx) => makeExperienceSlide(
      `s${6 + idx}`,
      `대표 장면 ${idx + 1}`,
      e.heading || `경험 ${idx + 1}`,
      e,
      e.role || e.period || '',
    )),
  ];
  // 경험 슬라이드 수에 맞춰 후속 슬라이드 id 동적 결정
  const expSlideCount = Math.min(expItems.length, 5);
  const afterExp = (offset) => `s${6 + expSlideCount + offset}`;
  slides.push(
    { id: afterExp(0), layout: 'proposal', sectionLabel: '성과 증거', proposalVariant: 'graphCallout', title: '성과는 흐름으로 누적되었습니다', subtitle: '단일 결과가 아니라 문제 해결 범위가 확장된 흔적을 보여줍니다',
      bullets: (primary.bullets?.length ? primary.bullets : ['문제 범위 확장', '실행 속도 개선', '협업 품질 향상']).slice(0, 4) },
    { id: afterExp(1), layout: 'proposal', sectionLabel: '직무 연결', proposalVariant: 'venn', title: '이 스토리가 지원 직무와 만나는 지점입니다', subtitle: '경험의 의미를 회사와 직무의 언어로 번역합니다', items: [
      { heading: `${userName}의 경험`, body: strengths[0] || expPoint(0, '문제 해결 경험') },
      { heading: target || '지원 직무', body: '필요 역량과 역할 기대' },
      { heading: '기여 메시지', body: firstMetric.label ? `${firstMetric.label} 중심의 검증된 실행력` : '성과로 검증한 실행력' },
    ] },
    { id: afterExp(2), layout: 'proposal', sectionLabel: '다음 기여', proposalVariant: 'gantt', title: '입사 후에는 이렇게 확장하겠습니다', subtitle: '합격자 포트폴리오의 마지막은 다짐보다 실행 계획이어야 합니다',
      items: ['맥락 파악', '대표 경험 적용', '핵심 과제 실행', '성과 회고'].map((heading, i) => ({ heading, role: ['Week 1', 'Week 2-3', 'Week 3-5', 'Week 6+'][i], body: primary.bullets?.[i] || '업무 기준에 맞춰 실행' })) },
    buildClosingSlide(ctx, afterExp(3)),
  );
  return finalizeAcceptedDeck({ title: `${userName} 스토리형 포트폴리오`, subtitle: target, accentColor: '#FF4F1A', templateMode: 'accepted-narrative' }, slides, ctx, 'narrative');
}

function buildStarDeckFromPortfolio(p) {
  const ctx = buildDeckContext(p);
  const { userName, target, expItems, firstMetric, metricText, pickBullets, expAt, expPoint } = ctx;

  // Notion 포트폴리오 섹션 데이터 추출
  const educationItems = portfolioEducationItems(ctx);
  const awardItems = portfolioAwardItems(ctx);
  const goalItems = portfolioGoalItems(ctx);
  const skillGroups = portfolioSkillGroups(ctx);

  const extra = p.extracurricular || {};
  const extraBadges = Array.isArray(extra.badges) ? extra.badges : [];
  const extraLangs = Array.isArray(extra.languages) ? extra.languages : [];
  const values = Array.isArray(p.values) ? p.values : [];
  const valuesEssay = p.valuesEssay || '';
  const curr = p.curricular || {};

  const eduSummary = [
    educationItems[0]?.heading || '',
    curr.summary?.gpa ? `GPA ${curr.summary.gpa}` : '',
    curr.summary?.credits ? `이수학점 ${curr.summary.credits}` : '',
  ].filter(Boolean).join(' · ');

  // 수상 + 비교과 통합 (최대 4개)
  const recognitionItems = [
    ...awardItems.slice(0, 2),
    ...extraBadges.slice(0, 2).map(b => ({ heading: b.name || '배지', period: b.issuer || '', body: b.issuer || '취득 자격', role: 'Badge', bullets: [] })),
    ...extraLangs.slice(0, 2).map(l => ({ heading: l.name || '어학', period: l.date || '', body: [l.score, l.date].filter(Boolean).join(' · '), role: 'Language', bullets: [] })),
  ].filter(item => item.heading).slice(0, 4);

  const slides = [
    // s1: 표지
    { id: 's1', layout: 'cover', title: `${userName} STAT/STAR 포트폴리오`, subtitle: target ? `${target} 맞춤 경험 검증 자료` : '상황·과제·행동·결과 중심 경험 검증 자료', bullets: ['SITUATION', 'TASK', 'ACTION', 'RESULT'] },

    // s2: 목차 (6섹션 — Notion 전체 내용 반영)
    { id: 's2', layout: 'proposal', sectionLabel: '목차', proposalVariant: 'contents', title: 'STAR 검증 순서', items: [
      { heading: '프로필 · 학력', role: 'Background', body: eduSummary || `${userName}의 배경과 학력 정보` },
      { heading: 'STAR 요약', role: 'Signal', body: '경험의 맥락과 결과 한눈에 보기' },
      { heading: '대표 STAR 경험', role: 'Evidence', body: `${expItems.length}건의 경험별 행동과 결과` },
      { heading: '수상 · 비교과', role: 'Achievement', body: awardItems.length > 0 ? `${awardItems.length}건의 인증 성과` : '수상 이력과 활동 성과' },
      { heading: '기술 역량', role: 'Skills', body: skillGroups.length > 0 ? skillGroups.slice(0, 2).map(s => s.heading).join(' · ') : '보유 기술 스택' },
      { heading: '목표와 계획', role: 'Future', body: goalItems.length > 0 ? goalItems[0].heading : '입사 후 기여 방향' },
    ] },

    // s3: 프로필 + 학력 (Notion education 데이터 반영)
    { id: 's3', layout: 'proposal', sectionLabel: '프로필 · 학력', proposalVariant: 'conditionGrid',
      title: `${userName}의 배경과 학력입니다`,
      subtitle: eduSummary || (target ? `${target} 지원을 위한 배경` : '포트폴리오 기반 주요 이력'),
      items: educationItems.length > 0
        ? [
          ...educationItems.slice(0, 2),
          ...(valuesEssay
            ? [{ heading: '가치관', body: valuesEssay.slice(0, 80) + (valuesEssay.length > 80 ? '...' : ''), role: 'Values', period: '', bullets: [] }]
            : values.slice(0, 1).map(v => ({ heading: v.keyword || '가치관', body: (v.description || '').slice(0, 80), role: 'Values', period: '', bullets: [] }))),
          { heading: '대표 경험', body: `${expItems.length}건의 주요 프로젝트`, role: 'Experience', period: target || '', bullets: [] },
        ].slice(0, 4)
        : [
          { heading: userName, body: target || '지원 직무와 맞닿은 역량', period: '', role: '', bullets: [] },
          { heading: '대표 경험', body: `${expItems.length}건 이상의 실무 경험`, period: '', role: '', bullets: [] },
          { heading: '핵심 역량', body: ctx.strengths[0] || '문제 해결력', period: '', role: '', bullets: [] },
          { heading: '지원 방향', body: target || '지원 직무 기여', period: '', role: '', bullets: [] },
        ],
    },

    // s4: STAR 요약
    { id: 's4', layout: 'proposal', sectionLabel: 'STAR 요약', proposalVariant: 'conditionGrid', title: '한 장으로 보는 STAR 시그널입니다', subtitle: '면접관이 바로 질문할 수 있도록 경험의 맥락과 결과를 분리합니다', items: [
      { heading: 'Situation', body: expAt(0).problem?.[0] || expPoint(0, '해결해야 할 상황') },
      { heading: 'Task', body: expAt(0).role || '내가 맡은 역할과 책임' },
      { heading: 'Action', body: expAt(0).action?.[0] || expPoint(1, '실행한 핵심 행동') },
      { heading: 'Result', body: firstMetric.label ? `${firstMetric.label} ${metricText(firstMetric)}` : expPoint(2, '변화와 성과') },
    ] },

    // s5: 경험 매핑 표
    { id: 's5', layout: 'proposal', sectionLabel: '경험 매핑', proposalVariant: 'roleTable', title: '경험별 STAR 포인트를 정리했습니다', subtitle: '합격 포트폴리오는 역할과 결과를 같은 표에서 확인할 수 있어야 합니다', table: [
      ['경험', 'S/T', 'Action', 'Result'],
      ...expItems.slice(0, 4).map((e, i) => [e.heading || `경험 ${i + 1}`, e.problem?.[0] || e.role || e.period || '문제/과제', e.action?.[0] || e.bullets?.[0] || '핵심 실행', e.result?.[0] || (e.metrics?.[0] ? `${e.metrics[0].label} ${metricText(e.metrics[0])}` : '성과 정리')]),
    ] },

    // s6-s8: 경험별 STAR 슬라이드 (최대 3개)
    ...expItems.slice(0, 3).map((e, i) => makeExperienceSlide(`s${6 + i}`, `STAR ${i + 1}`, `${e.heading || `대표 경험 ${i + 1}`}의 STAR`, e, `${e.role || e.period || '역할'} · 행동과 결과 중심`)),

    // s9: 성과 증거
    { id: 's9', layout: 'proposal', sectionLabel: '성과 증거', proposalVariant: 'darkStats', dark: true, title: 'STAR가 성과로 이어진 근거입니다', subtitle: '결과 슬라이드는 수치, 변화, 검증 방식이 함께 보여야 설득력이 생깁니다', metrics: ctx.metricPool.slice(0, 4) },

    // s10: 수상 · 비교과 (Notion awards + extracurricular 데이터 반영)
    { id: 's10', layout: 'proposal', sectionLabel: '수상 · 비교과', proposalVariant: 'conditionGrid',
      title: '수상 이력과 비교과 활동 성과입니다',
      subtitle: '학습 외 역량과 인증된 성과를 한눈에 확인합니다',
      items: recognitionItems.length > 0 ? recognitionItems : [
        { heading: '성과 인증', body: expItems[0]?.heading || '대표 경험', role: 'Evidence', period: '', bullets: [] },
        { heading: '직무 역량', body: ctx.strengths[0] || '문제 해결력', role: 'Competency', period: '', bullets: [] },
        { heading: '협업 경험', body: pickBullets()[0] || '팀 기반 실행', role: 'Collaboration', period: '', bullets: [] },
        { heading: '성장 방향', body: target || '지원 직무 기여', role: 'Growth', period: '', bullets: [] },
      ],
    },

    // s11: 기술 역량 (Notion skills 데이터 반영)
    { id: 's11', layout: 'proposal', sectionLabel: '기술 역량', proposalVariant: 'conditionGrid',
      title: '보유 기술 스택과 역량입니다',
      subtitle: '직무에서 즉시 활용 가능한 기술과 도구를 정리했습니다',
      items: skillGroups.length > 0 ? skillGroups.slice(0, 4) : [
        { heading: '핵심 역량', body: ctx.strengths[0] || '문제 해결력', role: 'Core', period: '', bullets: [] },
        { heading: '기술 스택', body: ctx.strengths.slice(1, 3).join(' · ') || '보유 기술 정리 중', role: 'Stack', period: '', bullets: [] },
        { heading: '직무 적합성', body: target ? `${target} 요구 기술 보유` : '지원 직무 즉시 기여 가능', role: 'Fit', period: '', bullets: [] },
        { heading: '성장 역량', body: pickBullets()[0] || '지속적 학습과 적용', role: 'Growth', period: '', bullets: [] },
      ],
    },

    // s12: 목표와 계획 (Notion goals 데이터 반영)
    { id: 's12', layout: 'proposal', sectionLabel: '목표와 계획', proposalVariant: 'gantt',
      title: goalItems.length > 0 ? '단계별 목표와 실행 계획입니다' : '입사 후 기여 방향과 실행 계획입니다',
      subtitle: '경험에서 배운 것을 다음 단계로 연결하는 계획입니다',
      items: goalItems.length > 0 ? goalItems.slice(0, 4) : [
        { heading: '맥락 파악', role: 'Week 1', body: pickBullets()[0] || '업무 기준에 맞춰 실행', period: 'Phase 1', bullets: [] },
        { heading: '대표 경험 적용', role: 'Week 2-3', body: pickBullets()[1] || '핵심 역량 투입', period: 'Phase 2', bullets: [] },
        { heading: '핵심 과제 실행', role: 'Week 3-5', body: pickBullets()[2] || '성과 창출', period: 'Phase 3', bullets: [] },
        { heading: '성과 회고', role: 'Week 6+', body: pickBullets()[3] || '반복 가능한 방식으로 정리', period: 'Phase 4', bullets: [] },
      ],
    },

    // s13: 직무 매칭
    { id: 's13', layout: 'proposal', sectionLabel: '직무 매칭', proposalVariant: 'criteria', title: target ? `${target} 요구 역량과 연결했습니다` : '지원 직무 요구 역량과 연결했습니다', subtitle: '경험을 직무 언어로 다시 묶어 면접 질문에 대비합니다', items: [
      { heading: '문제 정의력', body: pickBullets()[0] || '상황을 구조화하고 우선순위를 판단' },
      { heading: '실행력', body: pickBullets()[1] || '맡은 역할 안에서 실행안을 설계' },
      { heading: '성과 회고', body: firstMetric.label ? `${firstMetric.label} 기반 개선` : '결과를 다음 액션으로 연결' },
      { heading: '협업 방식', body: pickBullets()[2] || '관계자와 기준을 맞추고 실행' },
    ] },

    buildClosingSlide(ctx, 's14'),
  ];
  return finalizeAcceptedDeck({ title: `${userName} STAT/STAR 포트폴리오`, subtitle: target, accentColor: '#FF4F1A', templateMode: 'accepted-star' }, slides, ctx, 'star');
}

function buildKpiDashboardDeckFromPortfolio(p) {
  const ctx = buildDeckContext(p);
  const { userName, target, expItems, firstMetric, metricText, strengths, pickBullets, expAt } = ctx;
  const slides = [
    { id: 's1', layout: 'cover', title: `${userName} KPI 대시보드`, subtitle: target ? `${target} 성과 증거 중심 포트폴리오` : '정량 성과와 실행 근거 중심 포트폴리오', bullets: ['METRIC', 'BEFORE/AFTER', 'IMPACT'] },
    { id: 's2', layout: 'proposal', sectionLabel: '목차', proposalVariant: 'contents', title: 'KPI 검증 흐름', items: [
      { heading: '핵심 지표', role: 'Dashboard', body: '가장 먼저 볼 성과 숫자' },
      { heading: 'Before/After', role: 'Delta', body: '변화 폭과 원인' },
      { heading: '프로젝트 증거', role: 'Evidence', body: '지표를 만든 실행' },
      { heading: '리스크/보완', role: 'Review', body: '성과 해석의 한계와 대응' },
    ] },
    { id: 's3', layout: 'proposal', sectionLabel: 'KPI Snapshot', proposalVariant: 'darkStats', dark: true, title: '가장 먼저 확인할 핵심 성과입니다', subtitle: '숫자가 있는 합격 포트폴리오는 설명보다 먼저 신뢰를 만듭니다', metrics: ctx.metricPool.slice(0, 4) },
    { id: 's4', layout: 'proposal', sectionLabel: 'Before / After', proposalVariant: 'metricBars', title: '성과 변화폭을 기준으로 경험을 읽습니다', subtitle: '수치가 없는 항목은 역할과 검증 방식을 중심으로 보완합니다', bullets: pickBullets(['핵심 지표를 선정하고 변화 전후를 비교', '실행 과정에서 영향을 준 요인을 분리', '성과를 재현 가능한 업무 방식으로 정리', '다음 개선 가설까지 연결']) },
    { id: 's5', layout: 'proposal', sectionLabel: 'KPI Map', proposalVariant: 'roleTable', title: '프로젝트별 KPI와 기여 역할입니다', subtitle: '어떤 행동이 어떤 지표에 영향을 줬는지 한눈에 확인합니다', table: [
      ['프로젝트', '역할', '핵심 KPI', '증거'],
      ...expItems.slice(0, 4).map((e, i) => [e.heading || `경험 ${i + 1}`, e.role || e.period || '수행 역할', e.metrics?.[0] ? `${e.metrics[0].label} ${metricText(e.metrics[0])}` : '정성 성과', e.result?.[0] || e.bullets?.[0] || '실행 근거']),
    ] },
    makeExperienceSlide('s6', 'KPI Evidence', `${expAt(0).heading || '대표 경험'}의 성과 원인`, expAt(0), '지표 뒤에 있는 문제 해결 과정'),
    { id: 's7', layout: 'proposal', sectionLabel: '성과 추세', proposalVariant: 'graphCallout', title: '지표는 단발성이 아니라 학습 곡선입니다', subtitle: '성과가 반복 가능해진 이유와 다음 확장 가능성을 보여줍니다', bullets: pickBullets(['문제 정의 정확도 향상', '실행 속도 개선', '측정과 회고 루프 구축']) },
    { id: 's8', layout: 'proposal', sectionLabel: '역량 대시보드', proposalVariant: 'budget', dark: true, title: '포트폴리오 메시지의 성과 비중입니다', subtitle: '채용자가 보는 핵심 판단 기준에 맞춰 증거를 배치했습니다', items: [
      { heading: '40%', body: '정량 KPI와 변화폭' },
      { heading: '30%', body: '문제 해결 과정' },
      { heading: '20%', body: strengths[0] || '직무 연결 역량' },
      { heading: '10%', body: '학습과 확장성' },
    ] },
    { id: 's9', layout: 'proposal', sectionLabel: '리스크 관리', proposalVariant: 'risk', title: '성과 해석의 리스크와 보완 방식입니다', subtitle: '진짜 실무형 포트폴리오는 좋은 숫자만이 아니라 한계와 대응도 보여줍니다', items: [
      { heading: '맥락 누락', body: '지표가 나온 조건과 범위를 함께 설명' },
      { heading: '기여도 불명확', body: '내 역할과 협업 범위를 분리해 제시' },
      { heading: '재현성 부족', body: '다음 프로젝트에서 반복 가능한 방식으로 정리' },
    ] },
    { id: 's10', layout: 'proposal', sectionLabel: '직무 연결', proposalVariant: 'targetCircle', title: target ? `${target}에서 활용할 성과 자산입니다` : '지원 직무에서 활용할 성과 자산입니다', subtitle: '지표를 만든 행동을 입사 후 기여 방식으로 연결합니다', items: [
      { heading: userName, body: '성과를 만든 실행 방식' },
      { heading: firstMetric.label || '핵심 KPI', body: metricText(firstMetric) },
      { heading: target || '지원 직무', body: '업무 목표와 성과 기준' },
    ] },
    buildClosingSlide(ctx, 's11'),
  ];
  return finalizeAcceptedDeck({ title: `${userName} KPI 대시보드 포트폴리오`, subtitle: target, accentColor: '#FF4F1A', templateMode: 'accepted-kpi-dashboard' }, slides, ctx, 'kpi-dashboard');
}

function buildTimelineDeckFromPortfolio(p) {
  const ctx = buildDeckContext(p);
  const { userName, target, expItems, firstMetric, metricText, strengths, pickBullets, expAt, expPoint } = ctx;
  const slides = [
    { id: 's1', layout: 'cover', title: `${userName} 타임라인 포트폴리오`, subtitle: target ? `${target}로 이어지는 성장 경로` : '경험이 누적되어 역량이 된 과정', bullets: ['MILESTONE', 'GROWTH', 'NEXT'] },
    { id: 's2', layout: 'proposal', sectionLabel: '목차', proposalVariant: 'contents', title: '타임라인 구성', items: [
      { heading: '성장 곡선', role: 'Arc', body: '경험의 누적 방향' },
      { heading: '주요 마일스톤', role: 'Milestone', body: '전환점이 된 프로젝트' },
      { heading: '역량 확장', role: 'Expansion', body: '역할과 책임의 변화' },
      { heading: '다음 90일', role: 'Next', body: '입사 후 연결 계획' },
    ] },
    { id: 's3', layout: 'proposal', sectionLabel: '성장 곡선', proposalVariant: 'timeline', title: `${userName}의 주요 마일스톤입니다`, subtitle: '합격자 포트폴리오의 타임라인은 단순 이력이 아니라 역할의 확장 과정을 보여줍니다', items: expItems.slice(0, 5).map(e => ({ heading: e.heading, period: e.period || e.role, body: e.body || e.bullets?.[0] || '' })) },
    { id: 's4', layout: 'proposal', sectionLabel: '전환점', proposalVariant: 'stairSteps', title: '경험은 단계적으로 깊어졌습니다', subtitle: '문제 이해에서 성과 재현까지 성장 단계를 분리했습니다', items: ['관찰', '문제 정의', '실행 설계', '성과 검증', '재현 가능성'].map((heading, i) => ({ heading, body: pickBullets()[i] || expPoint(i, '성장 단계별 핵심 경험') })) },
    { id: 's5', layout: 'proposal', sectionLabel: '역할 변화', proposalVariant: 'roleTable', title: '시간에 따라 역할과 책임이 확장되었습니다', subtitle: '기간, 역할, 성과가 한 줄로 연결되어야 타임라인이 설득력을 갖습니다', table: [
      ['시기', '경험', '역할 확장', '성과/학습'],
      ...expItems.slice(0, 4).map((e, i) => [e.period || `Phase ${i + 1}`, e.heading || `경험 ${i + 1}`, e.role || e.action?.[0] || '수행 범위 확장', e.metrics?.[0] ? `${e.metrics[0].label} ${metricText(e.metrics[0])}` : e.result?.[0] || e.bullets?.[0] || '학습 정리']),
    ] },
    makeExperienceSlide('s6', '핵심 마일스톤', `가장 큰 전환점: ${expAt(0).heading || '대표 경험'}`, expAt(0), '성장 방향을 바꾼 대표 프로젝트'),
    { id: 's7', layout: 'proposal', sectionLabel: '성장 증거', proposalVariant: 'darkStats', dark: true, title: '누적된 경험이 만든 현재 역량입니다', subtitle: '마일스톤을 현재의 직무 강점으로 압축합니다', metrics: [
      { label: '대표 경험', value: `${expItems.length}+` },
      { label: firstMetric.label || '대표 성과', value: metricText(firstMetric) },
      { label: '핵심 강점', value: `${strengths.length || 3}+` },
      { label: '다음 방향', value: target ? '직무 맞춤' : '확장 가능' },
    ] },
    { id: 's8', layout: 'proposal', sectionLabel: '다음 90일', proposalVariant: 'stageCards', title: '입사 후 90일 실행 흐름입니다', subtitle: '타임라인의 마지막은 과거가 아니라 다음 기여로 닫습니다', items: ['온보딩', '문제 파악', '작은 성과', '반복 개선', '확장 기여'].map((heading, i) => ({ heading, body: pickBullets()[i] || '업무 맥락에 맞춰 실행' })) },
    { id: 's9', layout: 'proposal', sectionLabel: '직무 연결', proposalVariant: 'orbit', title: '모든 마일스톤은 하나의 기여 방향으로 모입니다', subtitle: '경험의 산발성을 줄이고 지원 직무의 핵심 메시지로 묶습니다', items: [
      { heading: '시작점', body: expAt(0).heading || '대표 경험' },
      { heading: '핵심 역량', body: strengths[0] || '문제 해결력' },
      { heading: '성과 증거', body: firstMetric.label ? `${firstMetric.label} ${metricText(firstMetric)}` : '실행 결과' },
      { heading: target || '지원 직무', body: '다음 기여 방향' },
    ] },
    buildClosingSlide(ctx, 's10'),
  ];
  return finalizeAcceptedDeck({ title: `${userName} 타임라인 포트폴리오`, subtitle: target, accentColor: '#FF4F1A', templateMode: 'accepted-timeline' }, slides, ctx, 'timeline');
}

function buildCaseStudyDeckFromPortfolio(p) {
  const ctx = buildDeckContext(p);
  const { userName, target, primary, firstMetric, metricText, strengths, pickBullets, expPoint } = ctx;
  const caseProject = primary.heading || '대표 프로젝트';
  const slides = [
    { id: 's1', layout: 'cover', title: `${caseProject} Case Study`, subtitle: target ? `${userName} · ${target} 맞춤 심화 사례` : `${userName} 대표 프로젝트 심화 분석`, bullets: ['PROBLEM', 'PROCESS', 'RESULT'] },
    { id: 's2', layout: 'proposal', sectionLabel: '목차', proposalVariant: 'contents', title: '케이스 스터디 흐름', items: [
      { heading: 'Context', role: 'Problem', body: '문제와 제약 조건' },
      { heading: 'Research', role: 'Insight', body: '판단 근거와 기준' },
      { heading: 'Execution', role: 'Build', body: '해결 과정과 내 역할' },
      { heading: 'Impact', role: 'Result', body: '성과와 검증' },
      { heading: 'Learning', role: 'Next', body: '배운 점과 확장' },
    ] },
    { id: 's3', layout: 'proposal', sectionLabel: 'Case Overview', proposalVariant: 'threeCards', title: `${caseProject}의 핵심 요약입니다`, subtitle: '합격자 케이스 스터디는 프로젝트 소개보다 문제·역할·결과를 먼저 보여줍니다', items: [
      { heading: 'Problem', body: primary.problem?.[0] || primary.body || '해결해야 할 문제와 사용자/비즈니스 맥락' },
      { heading: 'My Role', body: primary.role || '문제 해결 과정에서 맡은 역할과 책임 범위' },
      { heading: 'Impact', body: firstMetric.label ? `${firstMetric.label} ${metricText(firstMetric)}` : primary.result?.[0] || '성과와 학습을 함께 정리' },
    ] },
    { id: 's4', layout: 'proposal', sectionLabel: 'Problem', proposalVariant: 'conditionGrid', title: '문제와 제약 조건을 분리했습니다', subtitle: '깊이 있는 케이스 스터디는 무엇을 하지 않았는지도 보여줍니다', items: [
      { heading: 'User / 고객 문제', body: primary.problem?.[0] || expPoint(0, '사용자 또는 업무상 병목') },
      { heading: 'Business / 목표', body: target || '성과와 연결되는 목표 설정' },
      { heading: 'Constraint / 제약', body: primary.period || '기간, 리소스, 기술 제약 안에서 판단' },
      { heading: 'Decision / 기준', body: primary.action?.[0] || '우선순위와 실행 기준 수립' },
    ] },
    makeExperienceSlide('s5', 'Execution', `${caseProject} 실행 과정`, primary, '문제 정의, 실행, 결과를 STAR로 검증'),
    { id: 's6', layout: 'proposal', sectionLabel: 'Trade-off', proposalVariant: 'comparison', title: '선택과 포기 기준입니다', subtitle: '합격자 포트폴리오는 완성물보다 의사결정의 근거가 강합니다', items: [
      { heading: '선택한 방향', body: primary.action?.[0] || pickBullets()[0] || '가장 큰 문제를 먼저 줄이는 방향으로 실행' },
      { heading: '포기한 방향', body: primary.action?.[1] || '효과 대비 비용이 큰 범위는 후순위로 조정' },
    ] },
    { id: 's7', layout: 'proposal', sectionLabel: 'Build Log', proposalVariant: 'roleTable', title: '실행 로그와 산출물을 정리했습니다', subtitle: '프로세스가 보이면 결과의 신뢰도가 올라갑니다', table: [
      ['단계', '핵심 작업', '내 역할', '산출물'],
      ['Discover', primary.problem?.[0] || '문제 정의', primary.role || '문제 구조화', '문제/가설 정리'],
      ['Design', primary.action?.[0] || '해결안 설계', '우선순위 판단', '실행안/와이어프레임'],
      ['Build', primary.action?.[1] || expPoint(1, '구현 및 운영'), '핵심 실행', '프로토타입/배포'],
      ['Measure', primary.result?.[0] || '성과 검증', '회고와 개선', firstMetric.label ? `${firstMetric.label} ${metricText(firstMetric)}` : '결과 리포트'],
    ] },
    { id: 's8', layout: 'proposal', sectionLabel: 'Impact', proposalVariant: 'darkStats', dark: true, title: '검증된 결과와 변화입니다', subtitle: '성과는 숫자, 변화, 해석이 함께 있어야 합니다', metrics: ctx.metricPool.slice(0, 4) },
    { id: 's9', layout: 'proposal', sectionLabel: 'Learning', proposalVariant: 'pyramid', title: '케이스에서 얻은 학습을 다음 역량으로 연결합니다', subtitle: '성공 사례도 회고와 확장 계획이 있어야 실무형으로 읽힙니다', items: [
      { heading: 'Insight', body: strengths[0] || '문제를 쪼개고 기준을 세우는 힘' },
      { heading: 'System', body: strengths[1] || '성과를 재현 가능한 방식으로 정리' },
      { heading: 'Next', body: target ? `${target}에서 확장 가능한 기여` : '다음 프로젝트에서 확장할 방향' },
    ] },
    { id: 's10', layout: 'proposal', sectionLabel: 'Next Step', proposalVariant: 'gantt', title: '같은 문제를 다시 만나면 이렇게 확장하겠습니다', subtitle: '다음 액션이 분명하면 포트폴리오가 면접 질문으로 자연스럽게 이어집니다', items: ['맥락 재검증', '가설 우선순위화', '작은 실험', '성과 확장'].map((heading, i) => ({ heading, role: ['Week 1', 'Week 2', 'Week 3-4', 'Week 5+'][i], body: pickBullets()[i] || '검증 가능한 단위로 실행' })) },
    buildClosingSlide(ctx, 's11'),
  ];
  return finalizeAcceptedDeck({ title: `${userName} 케이스 스터디 포트폴리오`, subtitle: target, accentColor: '#FF4F1A', templateMode: 'accepted-case-study' }, slides, ctx, 'case-study');
}

function finalizeAcceptedDeck(meta, slides, ctx, mode) {
  if (mode === 'kpi-dashboard') {
    return {
      meta: { ...meta, templateMode: 'accepted-kpi-dashboard', referenceSlideCount: 22 },
      slides: buildKpiDashboardReferenceDeck(ctx),
    };
  }
  if (mode === 'timeline') {
    return {
      meta: { ...meta, templateMode: 'accepted-timeline', referenceSlideCount: 20 },
      slides: buildTimelineReferenceDeck(ctx),
    };
  }
  if (mode === 'star') {
    return {
      meta: { ...meta, templateMode: 'accepted-star', referenceSlideCount: 21 },
      slides: buildStarReferenceDeck(ctx),
    };
  }
  if (mode === 'narrative') {
    return {
      meta: { ...meta, templateMode: 'accepted-narrative', referenceSlideCount: 21 },
      slides: buildNarrativeReferenceDeck(ctx),
    };
  }
  if (mode === 'case-study') {
    return {
      meta: { ...meta, templateMode: 'accepted-case-study', referenceSlideCount: 21 },
      slides: buildCaseStudyReferenceDeck(ctx),
    };
  }
  return { meta, slides: expandAcceptedDeckToThirty(slides, ctx, mode) };
}

function normalizeReferenceSlides(slides) {
  return slides.map((slide, index) => ({ ...slide, id: `s${index + 1}` }));
}

function refMetric(label, value, body = '') {
  return { label, value, body };
}

function refItem(heading, body, period = '', role = '', bullets = []) {
  return { heading, body, period, role, bullets };
}

// 경험 추출 단계가 남긴 플레이스홀더/제너릭 필러. 슬라이드에 그대로 노출되면 안 됨.
const REF_PLACEHOLDER_RE = /작성\s*필요|원본에\s*없음|^\(?\s*예\s*[:：]|수상 및 인증 내역|학력 및 전공 정보|링크형 포트폴리오에 입력된|포트폴리오에 입력된/;

function stripPlaceholder(value) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  return REF_PLACEHOLDER_RE.test(s) ? '' : s;
}

function refText(value, fallback = '', max = 120) {
  const text = stripPlaceholder(value) || stripPlaceholder(fallback);
  return text.length > max ? text.slice(0, max) : text;
}

// 긴 설명형 경험 제목에서 간결한 프로젝트명만 추출. 슬라이드 제목이 설명 전체로 길어지는 문제 방지.
// 예: "KKSC 동아리 창설 - 가천대학교 학생들의..." → "KKSC 동아리 창설"
//     "...친밀도를 위한 QRious (2등 수상)" → "QRious (2등 수상)"
//     "...딥페이크 방지 Aegis" → "Aegis"
function projectName(heading) {
  let h = stripPlaceholder(heading);
  if (!h) return '';
  if (h.includes(' - ')) h = h.split(' - ')[0].trim();        // "이름 - 설명" → 이름
  if (h.length <= 24) return h;                                 // 이미 짧으면 그대로
  // 끝에 붙은 영문 제품명(+괄호 부가설명) 추출: QRious, Fitpoly, Aegis 등
  const m = h.match(/([A-Za-z][A-Za-z0-9.+\-]*(?:\s[A-Za-z0-9.+\-]+){0,2})(\s*\([^)]*\))?\s*$/);
  if (m && m[1] && m[1].length >= 3) return `${m[1]}${m[2] || ''}`.trim();
  return clipSentence(h, 24);                                   // 영문명 없으면 깔끔히 컷
}

// 카드형 슬롯용 truncation. 문장/쉼표/어미/공백 경계에서 잘라 "…" 중간 끊김을 피한다.
function clipSentence(value, max = 64) {
  const t = String(value || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const punct = Math.max(head.lastIndexOf('. '), head.lastIndexOf('? '), head.lastIndexOf('! '));
  if (punct >= max * 0.5) return head.slice(0, punct + 1).trim();
  const comma = Math.max(head.lastIndexOf(', '), head.lastIndexOf(','), head.lastIndexOf('·'), head.lastIndexOf('、'));
  if (comma >= max * 0.55) return head.slice(0, comma).trim();
  const eomi = head.match(/^[\s\S]*(?:하고|되어|하여|되고|으로|에서|다|고|며|함|음|됨)(?=[\s),.]|$)/);
  if (eomi && eomi[0].length >= max * 0.55) return eomi[0].trim();
  const sp = head.lastIndexOf(' ');
  if (sp >= max * 0.6) return head.slice(0, sp).trim();
  return head.trim();
}

function skillLabel(value) {
  return refText(typeof value === 'string' ? value : (value?.name || value?.title || value?.label || value?.skill || ''), '', 34);
}

function portfolioSkillGroups(ctx) {
  const skills = ctx.portfolio?.skills || {};
  const groups = [
    ['Languages', skills.languages],
    ['Frameworks', skills.frameworks],
    ['Tools', skills.tools],
    ['Certificates', skills.certificates],
    ['Others', skills.others],
  ].map(([label, list]) => {
    const names = (Array.isArray(list) ? list : []).map(skillLabel).filter(Boolean).slice(0, 5);
    return names.length ? refItem(names.slice(0, 2).join(' / '), names.slice(2).join(', ') || `${label} 기반 역량`, label, '', names) : null;
  }).filter(Boolean);
  if (groups.length) return groups;
  return ctx.strengths.slice(0, 4).map((strength, i) => refItem(strength, ctx.expPoint(i, '포트폴리오 기반 핵심 역량'), `Competency ${i + 1}`));
}

function portfolioEducationItems(ctx) {
  const education = Array.isArray(ctx.portfolio?.education) ? ctx.portfolio.education : [];
  return education.map((edu) => {
    const heading = edu.school || edu.name || edu.title || 'Education';
    const body = [edu.degree, edu.major, edu.detail, edu.description].filter(Boolean).join(' · ');
    return refItem(refText(heading, 'Education', 48), refText(body, '학력 및 전공 정보', 90), refText(edu.period || edu.date, '', 32), 'Education');
  }).filter(item => item.heading || item.body);
}

function portfolioAwardItems(ctx) {
  const awards = Array.isArray(ctx.portfolio?.awards) ? ctx.portfolio.awards : [];
  return awards.map((award) => {
    const heading = award.title || award.name || award.award || 'Award';
    const body = [award.issuer, award.organization, award.description, award.detail].filter(Boolean).join(' · ');
    return refItem(refText(heading, 'Award', 52), refText(body, '수상 및 인증 내역', 110), refText(award.date || award.period || award.year, '', 28), 'Award');
  }).filter(item => item.heading || item.body);
}

function portfolioGoalItems(ctx) {
  const goals = Array.isArray(ctx.portfolio?.goals) ? ctx.portfolio.goals : [];
  return goals.map((goal, i) => {
    if (typeof goal === 'string') return refItem(refText(goal, `Goal ${i + 1}`, 48), '포트폴리오에 입력된 목표와 성장 방향', `Phase ${i + 1}`);
    return refItem(refText(goal.title || goal.heading || `Goal ${i + 1}`, `Goal ${i + 1}`, 48), refText(goal.description || goal.content || goal.body, '포트폴리오에 입력된 목표와 성장 방향', 120), refText(goal.period || goal.date, `Phase ${i + 1}`, 24));
  }).filter(item => item.heading || item.body);
}

function portfolioValueItems(ctx) {
  const values = Array.isArray(ctx.portfolio?.values) ? ctx.portfolio.values : [];
  const valueItems = values.map((value, i) => {
    if (typeof value === 'string') return refItem(refText(value, `Value ${i + 1}`, 42), '링크형 포트폴리오에 입력된 가치관');
    return refItem(refText(value.keyword || value.title || `Value ${i + 1}`, `Value ${i + 1}`, 42), refText(value.description || value.content || value.body, '링크형 포트폴리오에 입력된 가치관', 110));
  }).filter(item => item.heading || item.body);
  if (valueItems.length) return valueItems;
  const essay = ctx.portfolio?.valuesEssay || ctx.portfolio?.about || '';
  return splitSentences(essay, 3).map((sentence, i) => refItem(['Experience', 'Memory', 'Value'][i] || `Value ${i + 1}`, sentence));
}

function portfolioContactBullets(ctx) {
  // 실제 연락처만 사용. 없으면 가짜 샘플 대신 이름만 표시(허위 연락처 유입 방지).
  return ctx.contactBullets.length ? ctx.contactBullets : [ctx.userName].filter(Boolean);
}

function expMetric(exp, index, fallback) {
  const metric = (exp.metrics || [])[index];
  if (metric && (metric.value || metric.before || metric.after || metric.label)) return metric;
  return fallback;
}

function projectBeforeAfterItems(exp) {
  return [
    refItem('Before', exp.problem?.[0] || exp.body || exp.bullets?.[0] || '초기 문제와 배경', 'BEFORE'),
    refItem('Constraint', exp.problem?.[1] || exp.bullets?.[1] || '해결 전 제약 조건'),
    refItem('After', exp.action?.[0] || exp.result?.[0] || exp.bullets?.[2] || '적용한 해결 방식', 'AFTER'),
    refItem('Impact', exp.result?.[1] || exp.metrics?.[0]?.label || exp.role || '성과와 기여'),
  ];
}

function projectRiskItems(exp) {
  return [
    refItem('Problem', exp.problem?.[0] || exp.body || '프로젝트에서 마주한 핵심 문제', 'Risk / Issue'),
    refItem('Decision', exp.action?.[0] || exp.bullets?.[0] || '문제를 해결하기 위해 선택한 접근 방식', 'Mitigation'),
    refItem('Execution', exp.action?.[1] || exp.bullets?.[1] || '실행 과정과 담당 역할', 'Process'),
    refItem('Result', exp.result?.[0] || exp.metrics?.[0]?.label || '결과와 배운 점', 'Outcome'),
  ];
}

function buildKpiDashboardReferenceDeck(ctx) {
  const userName = ctx.userName || 'Kim Yushin';
  const target = ctx.target || ctx.portfolio?.headline || ctx.portfolio?.title || 'Full-Stack Engineer';
  const projectA = ctx.expAt(0);
  const projectB = ctx.expAt(1);
  const projectC = ctx.expAt(2);
  const skillGroups = portfolioSkillGroups(ctx);
  const awards = portfolioAwardItems(ctx);
  const goals = portfolioGoalItems(ctx);
  const projectCount = Math.max(1, ctx.expItems.length);
  const awardCount = awards.length;
  const skillCount = skillGroups.flatMap(group => group.bullets || []).length || skillGroups.length;
  const projectName = (exp, fallback) => exp.heading && !/^경험|寃쏀뿕/.test(exp.heading) ? exp.heading : fallback;
  const projectSubtitle = (exp, fallback) => exp.role || exp.period || fallback;
  const projectBody = (exp, fallback) => exp.body || exp.bullets?.[0] || fallback;
  const slides = [
    {
      layout: 'kpi-cover',
      sectionLabel: 'Performance Dashboard',
      title: `${target}\n${userName}`,
      subtitle: ctx.portfolio?.headline || 'Portfolio Metrics & Strategic Impact',
      bullets: ['Portfolio Link', skillGroups[0]?.heading || 'Core Competency', ctx.portfolio?.templateId || 'Link Portfolio', 'Ready for Impact'],
    },
    {
      layout: 'kpi-executive',
      sectionLabel: 'Executive Summary',
      title: 'Performance Overview',
      subtitle: '핵심 성과와 성장 지표를 한 화면에서 읽히도록 정리했습니다.',
      metrics: [
        refMetric('Projects', String(projectCount).padStart(2, '0'), '링크형 포트폴리오의 주요 프로젝트/경험'),
        refMetric('Awards', String(awardCount).padStart(2, '0'), awards[0]?.heading || '수상 및 인증 내역'),
        refMetric('Skills', `${skillCount}+`, skillGroups[0]?.body || '기술 스택 및 핵심 역량'),
        refMetric('Contact', ctx.contactBullets.length ? 'ON' : 'READY', ctx.contactBullets[0] || '연락처 정보'),
      ],
    },
    {
      layout: 'kpi-skills',
      sectionLabel: 'Skill Architecture',
      title: 'Core Competency Analysis',
      items: skillGroups.slice(0, 4),
    },
    {
      layout: 'kpi-timeline',
      sectionLabel: 'Growth Analytics',
      title: 'Performance Timeline',
      items: [
        refItem('Foundation', 'Gachon Univ. CS 기반과 개발 역량 축적', '2021'),
        refItem('Full-Stack Shift', 'React/Node.js 스택으로 서비스 구현 범위 확장', '2023'),
        refItem('Scale & Standards', '개발 표준화와 AI 최적화 경험 축적', '2025'),
        refItem('Innovation', 'POPOl, WINNOW, reels로 실전 성과 검증', '2026'),
      ],
    },
    {
      layout: 'kpi-project',
      sectionLabel: 'Project Case 01',
      title: projectName(projectA, 'POPOL'),
      subtitle: projectSubtitle(projectA, 'AI-Driven Experience Structuring Platform'),
      items: [
        refItem('Core Mission', projectBody(projectA, '사용자의 파편화된 경험 데이터를 AI 엔진으로 분석 및 정규화하여 포트폴리오로 자동 변환하는 플랫폼을 구축했습니다.'), '2026.04 - 2026.05'),
        refItem('Lead Developer', 'Full-Stack Architecture Design'),
        refItem('AI Data Pipeline', 'Experience structuring and automation'),
        refItem('Impact', 'GCSC Grand Prize Winner'),
      ],
    },
    {
      layout: 'kpi-metrics',
      sectionLabel: 'Project 01: POPOL',
      title: 'AI Automation KPI Dashboard',
      metrics: [
        expMetric(projectA, 0, refMetric('Primary Result', '1', projectA.result?.[0] || projectA.bullets?.[0] || '핵심 성과')),
        expMetric(projectA, 1, refMetric('Role Scope', projectA.role || 'Lead', projectA.body || '담당 역할')),
        expMetric(projectA, 2, refMetric('Impact', projectA.period || 'Done', projectA.result?.[1] || '성과 요약')),
      ],
      items: [refItem('Workload Reduction', 'Manual process vs AI automation', 'TOTAL TIME SAVED: 290 MIN / UNIT')],
    },
    {
      layout: 'kpi-comparison',
      sectionLabel: 'POPOL Analysis',
      title: `Before vs After: ${projectName(projectA, 'Project 01')}`,
      items: projectBeforeAfterItems(projectA),
    },
    {
      layout: 'kpi-technical',
      sectionLabel: 'POPOL Infrastructure',
      title: 'Technical Performance KPI',
      metrics: [
        refMetric('System Uptime', '99.9%', 'High availability'),
        refMetric('API Success', '99.95%', 'Error-free operations'),
        refMetric('Security Score', 'A+', 'Zero vulnerabilities'),
      ],
    },
    {
      layout: 'kpi-risk',
      sectionLabel: 'System Integrity Audit',
      title: 'Risk Management & Mitigation',
      items: projectRiskItems(projectA),
    },
    {
      layout: 'kpi-project',
      sectionLabel: 'Project Case 02',
      title: projectName(projectB, 'WINNOW'),
      subtitle: projectSubtitle(projectB, 'AI Recruitment Automation Platform'),
      items: [
        refItem('Core Mission', projectBody(projectB, '채용 공고 분석부터 후보자 매칭까지의 전 과정을 AI 워크플로우로 자동화하여 채용 품질과 업무 효율을 개선했습니다.'), '2025.01 - 2025.06'),
        refItem('Full-Stack Developer', 'AI Matching Engine Development'),
        refItem('Dashboard UI/UX', 'Enterprise dashboard and workflow design'),
        refItem('Impact', 'Time-to-Hire Reduced by 60%'),
      ],
    },
    {
      layout: 'kpi-metrics',
      sectionLabel: 'Project 02: WINNOW',
      title: 'Recruitment KPI Dashboard',
      metrics: [
        expMetric(projectB, 0, refMetric('Primary Result', '1', projectB.result?.[0] || projectB.bullets?.[0] || '핵심 성과')),
        expMetric(projectB, 1, refMetric('Role Scope', projectB.role || 'Build', projectB.body || '담당 역할')),
        expMetric(projectB, 2, refMetric('Impact', projectB.period || 'Done', projectB.result?.[1] || '성과 요약')),
      ],
    },
    {
      layout: 'kpi-comparison',
      sectionLabel: 'WINNOW Transformation',
      title: `Before vs After: ${projectName(projectB, 'Project 02')}`,
      items: projectBeforeAfterItems(projectB),
    },
    {
      layout: 'kpi-technical',
      sectionLabel: 'WINNOW Infrastructure',
      title: 'Technical Performance KPI',
      metrics: [
        refMetric('API Reliability', '99.95%', 'High availability'),
        refMetric('Token Efficiency', '45%', 'Cost optimized'),
        refMetric('Cache Hit Rate', '88%', 'Low latency'),
      ],
    },
    {
      layout: 'kpi-risk',
      sectionLabel: 'AI Integrity Audit',
      title: 'Risk Management & Mitigation',
      items: projectRiskItems(projectB),
    },
    {
      layout: 'kpi-project',
      sectionLabel: 'Project Case 03',
      title: projectName(projectC, 'reels'),
      subtitle: projectSubtitle(projectC, 'Development Standardization Boilerplate'),
      items: [
        refItem('Core Mission', projectBody(projectC, '반복되는 초기 설정 과정을 모듈화된 보일러플레이트로 표준화하여 개발 시작 시간을 단축하고 코드 품질을 평준화했습니다.'), '2025.07 - 2025.12'),
        refItem('Core Modules', 'Unified Auth System'),
        refItem('API Wrapper', 'Standardized API communication'),
        refItem('Impact', 'Setup Time Reduced by 85%'),
      ],
    },
    {
      layout: 'kpi-metrics',
      sectionLabel: 'Project 03: reels',
      title: 'Standardization KPI Dashboard',
      metrics: [
        expMetric(projectC, 0, refMetric('Primary Result', '1', projectC.result?.[0] || projectC.bullets?.[0] || '핵심 성과')),
        expMetric(projectC, 1, refMetric('Role Scope', projectC.role || 'Build', projectC.body || '담당 역할')),
        expMetric(projectC, 2, refMetric('Impact', projectC.period || 'Done', projectC.result?.[1] || '성과 요약')),
      ],
    },
    {
      layout: 'kpi-comparison',
      sectionLabel: 'reels Impact Analysis',
      title: `Before vs After: ${projectName(projectC, 'Project 03')}`,
      items: projectBeforeAfterItems(projectC),
    },
    {
      layout: 'kpi-technical',
      sectionLabel: 'reels Optimization',
      title: 'Technical Performance KPI',
      metrics: [
        refMetric('Build Speed', '12s', '70% faster with Vite'),
        refMetric('Bundle Size', '540KB', '55% reduced'),
        refMetric('Test Coverage', '95%', 'High reliability'),
      ],
    },
    {
      layout: 'kpi-risk',
      sectionLabel: 'Standardization Audit',
      title: 'Risk Management & Mitigation',
      items: projectRiskItems(projectC),
    },
    {
      layout: 'kpi-cumulative',
      sectionLabel: 'Executive Summary',
      title: 'Cumulative Impact Analysis',
      metrics: [
        refMetric('Projects', `${projectCount}`, '포트폴리오에 등록된 주요 경험'),
        refMetric('Skills', `${skillCount}+`, '기술 스택 및 역량 키워드'),
        refMetric('Awards', `${awardCount}`, '수상/인증/성과 기록'),
      ],
    },
    {
      layout: 'kpi-roadmap',
      sectionLabel: 'Vision & Growth',
      title: 'Future Growth KPI & Roadmap',
      metrics: skillGroups.slice(0, 3).map(group => refMetric(group.period || 'Skill', group.heading, group.body)),
      items: (goals.length ? goals : [
        refItem('Next Growth', ctx.portfolio?.valuesEssay || ctx.portfolio?.about || '포트폴리오에 입력된 목표를 기반으로 다음 성장 방향을 정리했습니다.', 'Next'),
        refItem('Skill Expansion', skillGroups[0]?.heading || 'Core Skill', skillGroups[0]?.body || '핵심 역량 확장'),
        refItem('Project Impact', ctx.expPoint(0, '프로젝트 성과 확장'), 'Future'),
      ]).slice(0, 3),
    },
    {
      layout: 'kpi-closing',
      sectionLabel: 'Final Report',
      title: 'Thank You for Your Time',
      subtitle: `${target} & System Architect: ${userName}`,
      metrics: [
        refMetric('Total Efficiency', '85% UP'),
        refMetric('System Stability', '99.9%'),
        refMetric('AI Innovation', '94% ACC'),
      ],
      bullets: portfolioContactBullets(ctx),
    },
  ];
  return normalizeReferenceSlides(slides);
}

function buildTimelineReferenceDeck(ctx) {
  const userName = ctx.userName || 'Kim Yushin';
  const target = ctx.target || ctx.portfolio?.headline || ctx.portfolio?.title || 'Full-Stack Developer';
  const projectA = ctx.expAt(0);
  const projectB = ctx.expAt(1);
  const projectC = ctx.expAt(2);
  const education = portfolioEducationItems(ctx);
  const awards = portfolioAwardItems(ctx);
  const goals = portfolioGoalItems(ctx);
  const values = portfolioValueItems(ctx);
  const skillGroups = portfolioSkillGroups(ctx);
  const projectName = (exp, fallback) => exp.heading && !/^경험|寃쏀뿕/.test(exp.heading) ? exp.heading : fallback;
  const projectBody = (exp, fallback) => exp.body || exp.bullets?.[0] || fallback;
  const slides = [
    {
      layout: 'timeline-cover',
      sectionLabel: '2021 - 2026 Growth Archive',
      title: `${target}\nPortfolio`,
      subtitle: ctx.portfolio?.headline || `${userName}의 성장 타임라인`,
      bullets: [userName, target, education[0]?.heading || 'Education'],
    },
    {
      layout: 'timeline-philosophy',
      sectionLabel: 'Development Philosophy',
      proposalVariant: 'contents',
      title: ctx.portfolio?.valuesEssay ? `"${refText(ctx.portfolio.valuesEssay, '', 70)}"` : '"경험을 가치로 바꾸는\n기록과 구조화의 힘을 믿습니다."',
      items: (values.length ? values : [
        refItem('Experience', '링크형 포트폴리오에 입력된 경험을 논리적으로 구조화합니다.'),
        refItem('Memory', '성장의 과정을 정리해 재사용 가능한 근거로 만듭니다.'),
        refItem('Value', '사용자와 팀에 전달되는 실질적 가치에 집중합니다.'),
      ]).slice(0, 3),
    },
    {
      layout: 'timeline-profile',
      sectionLabel: 'Profile',
      proposalVariant: 'darkStats',
      title: userName,
      subtitle: 'Profile & Key Metrics',
      metrics: [
        refMetric('Projects', `${ctx.expItems.length}+`, '등록된 프로젝트/경험'),
        refMetric('Skills', `${skillGroups.flatMap(group => group.bullets || []).length || skillGroups.length}+`, '기술 스택 및 역량'),
        refMetric('Awards', `${awards.length}`, '수상 및 인증'),
      ],
      items: [
        education[0] || refItem('Education', '학력 정보가 입력되면 이 영역에 반영됩니다.', 'Education'),
        skillGroups[0] || refItem('Skill', '기술 스택 정보가 입력되면 이 영역에 반영됩니다.', 'Skill'),
        refItem(target || 'Focus', ctx.portfolio?.headline || ctx.portfolio?.title || '포트폴리오 핵심 포지션', 'Focus'),
      ],
    },
    {
      layout: 'timeline-master',
      sectionLabel: 'Master Timeline',
      proposalVariant: 'timeline',
      title: 'Growth Journey 2021 - 2026',
      items: ctx.expItems.slice(0, 5).map(exp => refItem(exp.heading, exp.body || exp.bullets?.[0] || exp.role, exp.period || exp.role)),
    },
    {
      layout: 'timeline-stack',
      sectionLabel: 'Technical Stack I',
      proposalVariant: 'stack',
      title: 'Frontend & Mobile Engineering',
      items: skillGroups.slice(0, 3),
    },
    {
      layout: 'timeline-stack',
      sectionLabel: 'Technical Stack II',
      proposalVariant: 'stack',
      title: 'Backend & AI Integration',
      items: (skillGroups.length > 3 ? skillGroups.slice(3, 6) : skillGroups.slice(0, 3)),
    },
    {
      layout: 'timeline-project',
      sectionLabel: 'Project 01',
      proposalVariant: 'project',
      title: `${projectName(projectA, 'POPOL')}: AI-Driven Experience Structuring`,
      subtitle: '2026.04 - Full-Stack Development',
      items: [
        refItem('Project Concept', projectBody(projectA, '사용자의 흩어진 경험 데이터를 AI로 분석하여 맞춤형 포트폴리오와 자기소개서 초안을 자동 생성하는 플랫폼입니다.')),
        refItem('Core Mission', '비정형화된 경험 데이터를 논리적인 역량 지표로 변환하여 구직자가 자신의 가치를 효과적으로 증명하도록 지원했습니다.'),
        refItem('Lead Developer', 'React 기반 모듈형 UI 아키텍처와 Node.js API 서버를 총괄했습니다.'),
      ],
    },
    {
      layout: 'timeline-architecture',
      sectionLabel: 'Project 01 Architecture',
      proposalVariant: 'architecture',
      title: `${projectName(projectA, 'Project 01')} Flow & Process`,
      items: [
        refItem('Context', projectA.problem?.[0] || projectA.body || '프로젝트 배경과 문제 정의'),
        refItem('Role', projectA.role || '담당 역할'),
        refItem('Action', projectA.action?.[0] || projectA.bullets?.[0] || '핵심 실행 과정'),
        refItem('Result', projectA.result?.[0] || projectA.metrics?.[0]?.label || '결과와 성과'),
      ],
    },
    {
      layout: 'timeline-challenge',
      sectionLabel: 'Technical Challenge 01',
      proposalVariant: 'conditionGrid',
      title: `${projectName(projectA, 'Project 01')} Challenge`,
      items: projectRiskItems(projectA),
    },
    {
      layout: 'timeline-challenge',
      sectionLabel: 'Technical Challenge 02',
      proposalVariant: 'risk',
      title: `${projectName(projectA, 'Project 01')} Problem Solving`,
      items: projectBeforeAfterItems(projectA),
    },
    {
      layout: 'timeline-detail',
      sectionLabel: 'Project 01 Security',
      proposalVariant: 'detail',
      title: `${projectName(projectA, 'Project 01')} Technical Detail`,
      items: [
        refItem('Role', projectA.role || '담당 역할'),
        refItem('Action 01', projectA.action?.[0] || projectA.bullets?.[0] || '핵심 실행'),
        refItem('Action 02', projectA.action?.[1] || projectA.bullets?.[1] || '보완 실행'),
        refItem('Result', projectA.result?.[0] || projectA.metrics?.[0]?.label || '검증된 결과'),
      ],
    },
    {
      layout: 'timeline-outcomes',
      sectionLabel: 'Project 01 Outcomes',
      proposalVariant: 'darkStats',
      title: 'Growth & Technical Results',
      metrics: [
        refMetric('Efficiency Gain', '80%', '포트폴리오 초안 생성 시간 대폭 단축'),
        refMetric('System Stability', '99.9%', '무중단 서비스 운영'),
        refMetric('User Satisfaction', '4.8/5', '베타 테스트 만족도'),
      ],
      items: [
        refItem('Technical Achievements', '비정형 데이터 정형화 스키마 표준화 및 SSRF 취약점 제거'),
        refItem('Qualitative Feedback', '막막했던 경험 정리가 AI 덕분에 논리적으로 변했습니다.'),
      ],
    },
    {
      layout: 'timeline-project',
      sectionLabel: 'Project 02',
      proposalVariant: 'project',
      title: `${projectName(projectB, 'WINNOW')}: AI Recruitment Automation`,
      subtitle: '2026.05 - AI Integration & Full-Stack Development',
      items: [
        refItem('Smart JD Generation', projectBody(projectB, '기업의 핵심 요구사항을 입력하면 Gemini AI가 최적화된 채용 공고를 자동 생성하고 관리하는 플랫폼입니다.')),
        refItem('Inefficient Process', '반복적이고 시간이 많이 소요되는 채용 공고 작성 업무를 자동화했습니다.'),
        refItem('AI-Driven Workflow', 'LLM 기반 텍스트 생성 엔진과 통합 대시보드로 채용 공고 작성 시간을 단축했습니다.'),
      ],
    },
    {
      layout: 'timeline-detail',
      sectionLabel: 'Project 02 AI Integration',
      proposalVariant: 'detail',
      title: `${projectName(projectB, 'Project 02')} Technical Detail`,
      items: [
        refItem('Problem', projectB.problem?.[0] || projectB.body || '프로젝트 문제 정의'),
        refItem('Action 01', projectB.action?.[0] || projectB.bullets?.[0] || '핵심 실행'),
        refItem('Action 02', projectB.action?.[1] || projectB.bullets?.[1] || '보완 실행'),
        refItem('Result', projectB.result?.[0] || projectB.metrics?.[0]?.label || '검증된 결과'),
      ],
    },
    {
      layout: 'timeline-project',
      sectionLabel: 'Project 03',
      proposalVariant: 'project',
      title: `${projectName(projectC, 'reels')}: Development Standardization`,
      subtitle: '2026.05 - React-Vite Boilerplate Framework',
      items: [
        refItem('Eliminate Repetition', projectBody(projectC, '반복적인 초기 설정 작업을 자동화하고 팀 내 개발 표준을 강제하여 생산성을 극대화했습니다.')),
        refItem('Pre-configured Stack', 'TypeScript, Zustand, TailwindCSS, Axios 등 검증된 기술 스택을 사전 구성했습니다.'),
        refItem('Quality Assurance', '일관된 폴더 구조와 코드 컨벤션으로 리뷰 효율을 높였습니다.'),
      ],
    },
    {
      layout: 'timeline-challenge',
      sectionLabel: 'Project 03 Principles',
      proposalVariant: 'conditionGrid',
      title: `${projectName(projectC, 'Project 03')} Principles`,
      items: [
        refItem('Problem', projectC.problem?.[0] || projectC.body || '프로젝트 문제 정의'),
        refItem('Decision', projectC.action?.[0] || projectC.bullets?.[0] || '핵심 판단과 실행'),
        refItem('Build', projectC.action?.[1] || projectC.bullets?.[1] || '구현 과정'),
        refItem('Result', projectC.result?.[0] || projectC.metrics?.[0]?.label || '성과와 배운 점'),
      ],
    },
    {
      layout: 'timeline-awards',
      sectionLabel: 'Recognition',
      proposalVariant: 'darkStats',
      title: 'Awards & Honors',
      metrics: awards[0] ? [refMetric(awards[0].heading, awards[0].period || 'Award', awards[0].body)] : [refMetric('Awards', `${awards.length}`, '링크형 포트폴리오의 수상/인증 내역')],
      items: (awards.length ? awards : [
        refItem('Awards', '수상/인증 정보가 입력되면 이 영역에 반영됩니다.'),
      ]).slice(0, 5),
    },
    {
      layout: 'timeline-growth',
      sectionLabel: 'Growth Mindset',
      proposalVariant: 'detail',
      title: 'Continuous Learning & Contribution',
      items: (values.length ? values : [
        refItem('Learning', ctx.portfolio?.about || ctx.portfolio?.valuesEssay || '학습과 기여 활동을 포트폴리오 내용 기반으로 정리합니다.'),
        refItem('Contribution', ctx.expPoint(0, '프로젝트 경험에서 확인된 기여 포인트')),
      ]).slice(0, 4),
    },
    {
      layout: 'timeline-roadmap',
      sectionLabel: 'Vision',
      proposalVariant: 'gantt',
      title: 'Future Roadmap & Vision',
      items: (goals.length ? goals : [
        refItem('Short-Term Growth', ctx.expPoint(0, '현재 경험을 기반으로 한 단기 성장 목표'), 'Phase 01'),
        refItem('Mid-Term Expansion', skillGroups[0]?.heading || '핵심 기술 역량 확장', 'Phase 02'),
        refItem('Long-Term Vision', target || '지원 포지션과 연결된 장기 비전', 'Phase 03'),
      ]).slice(0, 3),
    },
    {
      layout: 'timeline-closing',
      sectionLabel: 'Final Report',
      proposalVariant: 'closing',
      dark: true,
      title: 'Thank You for Your Time',
      subtitle: `기술로 가치를 창출하고 시스템의 안정성을 설계하는 개발자 ${userName}입니다.`,
      bullets: portfolioContactBullets(ctx),
    },
  ];
  return normalizeReferenceSlides(slides);
}

function buildStarReferenceDeck(ctx) {
  const userName = ctx.userName;
  const target = ctx.target;
  const education = portfolioEducationItems(ctx);
  const awards = portfolioAwardItems(ctx);
  const goals = portfolioGoalItems(ctx);
  const skillGroups = portfolioSkillGroups(ctx);
  const eduItem = education[0] || refItem(userName, target || '포트폴리오 기반 학습 이력', '');
  const pName = (exp, fb) => (exp.heading && !/^경험|^대표/.test(exp.heading)) ? exp.heading : fb;
  const pBody = (exp, fb) => exp.body || exp.bullets?.[0] || fb;
  const pMetrics = (exp) => {
    const raw = (exp.metrics || []).slice(0, 3).filter(m => m.label || m.value || m.after);
    return raw.length ? raw.map(m => refMetric(m.label || '성과', m.value || m.after || '달성', m.before && m.after ? `${m.before} → ${m.after}` : m.body || '')) : null;
  };
  const makeProjectSlides = (exp, num) => {
    const label = pName(exp, `Project ${String(num).padStart(2, '0')}`);
    const metrics = pMetrics(exp) || [refMetric('성과', `${num}+`, exp.result?.[0] || '달성')];
    return [
      {
        layout: 'star-situation',
        sectionLabel: `${String(num).padStart(2, '0')} ${label}`,
        starPhase: 'S',
        title: `Situation · ${label}`,
        subtitle: exp.role || exp.period || '담당 역할과 배경',
        body: exp.problem?.[0] || pBody(exp, '해결해야 했던 상황과 배경 맥락'),
        metrics: metrics.slice(0, 2),
      },
      {
        layout: 'star-task',
        sectionLabel: `${String(num).padStart(2, '0')} ${label}`,
        starPhase: 'T',
        title: `Task · ${label}`,
        items: [
          refItem(exp.role || '담당 역할', exp.problem?.[0] || pBody(exp, '맡은 책임 범위'), 'ROLE'),
          refItem('핵심 과제', exp.problem?.[1] || exp.action?.[0] || '해결해야 할 핵심 문제', 'CHALLENGE'),
          refItem('목표 설정', exp.result?.[0] || '달성해야 할 목표와 성공 기준', 'GOAL'),
        ],
      },
      {
        layout: 'star-action',
        sectionLabel: `${String(num).padStart(2, '0')} ${label}`,
        starPhase: 'A',
        title: `Action · ${label}`,
        items: [
          refItem('문제 분석', exp.action?.[0] || pBody(exp, '상황을 분석하고 접근 방식 결정'), '01'),
          refItem('핵심 실행', exp.action?.[1] || exp.bullets?.[0] || '핵심 기능 구현 및 문제 해결', '02'),
          refItem('검증 반영', exp.action?.[2] || exp.bullets?.[1] || '결과 검증과 개선 적용', '03'),
        ],
      },
      {
        layout: 'star-result',
        sectionLabel: `${String(num).padStart(2, '0')} ${label}`,
        starPhase: 'R',
        title: `Result · ${label}`,
        metrics: metrics.slice(0, 3),
        body: exp.result?.[0] || (exp.bullets || []).slice(-1)[0] || '경험에서 얻은 핵심 인사이트와 성장',
      },
      {
        layout: 'star-qa',
        sectionLabel: `${String(num).padStart(2, '0')} ${label} · Q&A`,
        starPhase: 'QA',
        title: `${label} 면접 예상 Q&A`,
        items: [
          refItem(
            '이 경험에서 가장 어려웠던 점은 무엇인가요?',
            exp.problem?.[0] || '불명확한 요구사항 속에서 문제를 정의하고 우선순위를 설정하는 과정이 가장 도전적이었습니다.',
            'Q1'
          ),
          refItem(
            '결과를 어떻게 측정하고 검증했나요?',
            metrics[0] ? `${metrics[0].label}: ${metrics[0].value}${metrics[0].body ? ' (' + metrics[0].body + ')' : ''}` : exp.result?.[0] || '정량적 지표와 팀 피드백을 통해 성과를 검증했습니다.',
            'Q2'
          ),
        ],
      },
    ];
  };
  const projectA = ctx.expAt(0);
  const projectB = ctx.expAt(1);
  const projectC = ctx.expAt(2);
  const slides = [
    {
      layout: 'star-cover',
      sectionLabel: 'STAT / STAR PORTFOLIO',
      title: userName,
      subtitle: target ? `${target} 맞춤 포트폴리오` : 'STAR 기반 경험 검증 포트폴리오',
      items: [
        refItem('SITUATION', projectA.problem?.[0] || pBody(projectA, '맥락과 배경')),
        refItem('TASK', projectA.role || '담당 역할과 과제'),
        refItem('ACTION', projectA.action?.[0] || pBody(projectA, '실행한 방법')),
        refItem('RESULT', projectA.result?.[0] || (ctx.firstMetric?.label ? `${ctx.firstMetric.label} ${ctx.metricText(ctx.firstMetric)}` : '핵심 성과')),
      ],
    },
    {
      layout: 'star-identity',
      sectionLabel: 'PROFESSIONAL IDENTITY',
      title: `${userName}을 소개합니다`,
      subtitle: target || skillGroups[0]?.heading || '',
      items: [
        refItem(eduItem.heading || '학력', eduItem.body || '포트폴리오 기반 학습 이력', '', 'edu'),
        refItem('지원 방향', target || skillGroups[0]?.heading || '보유 역량 기반 직무 기여', '', 'target'),
        refItem('핵심 강점', ctx.strengths[0] || '문제 해결 중심의 실행력', '', 'strength'),
      ],
    },
    {
      layout: 'star-timeline',
      sectionLabel: 'EXPERIENCE TIMELINE',
      title: '경험 타임라인',
      items: ctx.expItems.slice(0, 4).map((e, i) => ({
        heading: e.heading || `경험 ${i + 1}`,
        body: e.role || e.bullets?.[0] || e.body || '주요 역할과 성과',
        period: e.period || `Phase ${i + 1}`,
        role: e.problem?.[0] || 'SITUATION',
      })),
    },
    ...makeProjectSlides(projectA, 1),
    ...makeProjectSlides(projectB, 2),
    ...makeProjectSlides(projectC, 3),
    {
      layout: 'star-awards',
      sectionLabel: 'HONORS & RECOGNITION',
      title: '수상 및 인증 이력',
      items: awards.length > 0 ? awards.slice(0, 3) : [
        refItem('성과 인증', ctx.expPoint(0, '경험에서 확인된 성과와 역량'), '인증 내역', 'Award'),
        refItem('직무 역량', ctx.strengths[0] || '문제 해결력', '핵심 역량', 'Competency'),
        refItem('협업 경험', ctx.expPoint(1, '팀 기반 실행 경험'), '팀 기여', 'Collaboration'),
      ],
    },
    {
      layout: 'star-roadmap',
      sectionLabel: 'FUTURE ROADMAP',
      title: '성장 로드맵',
      items: goals.length > 0 ? goals.slice(0, 3) : [
        refItem('단기 목표', ctx.expPoint(0, '현재 경험 기반 단기 성장 목표'), 'Phase 01'),
        refItem('중기 성장', skillGroups[0]?.heading || '핵심 기술 역량 확장', 'Phase 02'),
        refItem('장기 비전', target || '지원 포지션 연결 장기 비전', 'Phase 03'),
      ],
    },
    {
      layout: 'star-closing',
      dark: true,
      sectionLabel: 'THANK YOU',
      title: '감사합니다',
      subtitle: target ? `${target}에서 함께 성장하고 싶습니다` : '포트폴리오를 검토해 주셔서 감사합니다',
      bullets: portfolioContactBullets(ctx),
    },
  ];
  return normalizeReferenceSlides(slides);
}

function buildNarrativeReferenceDeck(ctx) {
  // 전부 사용자 데이터 기반. 하드코딩 샘플(POPOL/WINNOW/Boilerplate/GCSC 등) 금지.
  // 데이터가 없는 슬라이드/항목은 채우지 않고 생략한다 → 남의 내용 유입·공백 방지.
  const userName = ctx.userName || '지원자';
  const target = ctx.target || ctx.portfolio?.headline || ctx.portfolio?.title || '';
  const education = portfolioEducationItems(ctx);
  const awards = portfolioAwardItems(ctx);
  const goals = portfolioGoalItems(ctx);
  const values = portfolioValueItems(ctx);
  const skillGroups = portfolioSkillGroups(ctx);
  const projects = ctx.expItems.slice(0, 5); // 실제 경험 수만큼만
  const slides = [];

  // 표지용 깔끔한 지원 라인 — 회사/직무 원문에서 분석 메모( - , ※, (...) )를 떼고 "회사 · 직무"로.
  const coverLine = (s) => stripPlaceholder(s).split(/\s*(?:[-–—]\s|[(※\[])/)[0].trim();
  const coverCompany = coverLine(ctx.portfolio?.targetCompany);
  const coverPosition = coverLine(ctx.portfolio?.targetPosition);
  const coverSubtitle = [coverCompany, coverPosition].filter(Boolean).join(' · ')
    || coverLine(ctx.portfolio?.headline) || coverLine(target);

  // 1) Cover — 제목은 이름 기반, 부제는 깔끔한 지원 라인
  slides.push({
    layout: 'narrative-cover',
    sectionLabel: `${userName} PORTFOLIO`,
    title: `${userName}의 포트폴리오`,
    subtitle: coverSubtitle ? `${coverSubtitle} 지원` : `${userName}의 경험과 역량`,
    bullets: skillGroups.slice(0, 5).map(g => g.heading).filter(Boolean),
  });

  // 2) Profile — 학력/가치관/수상 중 하나라도 있을 때만
  if (education.length || ctx.portfolio?.valuesEssay || awards.length) {
    slides.push({
      layout: 'narrative-profile',
      sectionLabel: 'Profile',
      title: ctx.portfolio?.headline || `${userName}의 배경`,
      items: education.slice(0, 2).length ? education.slice(0, 2) : [refItem(userName, target || '지원자', 'Profile')],
      metrics: awards.slice(0, 3).map(a => refMetric(a.heading, a.period || 'Award', a.body)),
      subtitle: ctx.portfolio?.valuesEssay ? `"${refText(ctx.portfolio.valuesEssay, '', 80)}"` : '',
    });
  }

  // 3) Philosophy — 가치관 데이터가 있을 때만
  if (values.length) {
    slides.push({
      layout: 'narrative-philosophy',
      sectionLabel: 'Philosophy',
      title: '내가 일하는 방식과 가치관',
      items: values.slice(0, 3),
      subtitle: refText(ctx.portfolio?.about, '', 120),
    });
  }

  // 4) Skills — 기술 데이터가 있을 때만
  if (skillGroups.length) {
    slides.push({
      layout: 'narrative-skills',
      sectionLabel: 'Technical Skills',
      title: '기술 역량 맵',
      items: skillGroups.slice(0, 6),
      subtitle: target,
    });
  }

  // 5) 프로젝트별 슬라이드 — 각 경험의 "자기 데이터"만 사용 (플레이스홀더 제거)
  const pad = (n) => String(n).padStart(2, '0');
  const metricText = (m) => `${stripPlaceholder(m.label)} ${m.value || (m.before && m.after ? `${m.before}→${m.after}` : '')}`.trim();
  projects.forEach((proj, idx) => {
    const label = `Project ${pad(idx + 1)}`;
    const pname = projectName(proj.heading) || `프로젝트 ${idx + 1}`;
    const body = stripPlaceholder(proj.body);
    const period = stripPlaceholder(proj.period);
    const role = clipSentence(stripPlaceholder(proj.role), 72); // 좌측 subtitle 잘림 방지
    const problems = (proj.problem || []).map(stripPlaceholder).filter(Boolean);
    const actions = (proj.action || []).map(stripPlaceholder).filter(Boolean);
    const results = (proj.result || []).map(stripPlaceholder).filter(Boolean);
    const learnings = (proj.learning || []).map(stripPlaceholder).filter(Boolean);
    const projBullets = (proj.bullets || []).map(stripPlaceholder).filter(Boolean);
    const metricLines = (proj.metrics || []).map(metricText).filter(Boolean);

    // 5-1) Overview — subtitle(좌측)에는 역할, items(우측)에는 Overview/기간. body 를 양쪽에 중복 금지.
    const overviewBody = clipSentence(body, 108); // 우측 OVERVIEW 3줄 잘림 방지
    const overviewItems = [
      overviewBody && refItem('Overview', overviewBody),
      period && refItem('기간', period),
    ].filter(Boolean);
    slides.push({
      layout: 'narrative-project',
      sectionLabel: label,
      title: pname,
      subtitle: role,
      items: overviewItems.length ? overviewItems : [refItem('Overview', overviewBody || pname)],
      bullets: (proj.keywords || []).map(stripPlaceholder).filter(Boolean).slice(0, 8),
    });

    // 5-2) 문제 & 해결
    // THE PROBLEM: proj.problem(context). CORE TASKS: actions(없으면 bullets).
    // clipSentence 로 문장/어절 경계에서 잘라 "…" 중간 끊김 방지.
    // THE PROBLEM: context(problems) 우선. 비면 개요 첫 문장으로 채워 빈칸 방지.
    const problemRaw = problems.length ? problems : (body ? [body] : []);
    const problemSrc = problemRaw.slice(0, 3).map(p => clipSentence(p, 130));   // 완전한 문장 우선 (fit:shrink 가 축소)
    // CORE TASKS: actions 우선, 부족하면 bullets 로 보강해 여러 개 표시 (20자 prefix 로 중복 제거)
    const actionPool = [...actions];
    for (const b of projBullets) {
      if (actionPool.length >= 3) break;
      if (!actionPool.some(a => a.slice(0, 20) === b.slice(0, 20))) actionPool.push(b);
    }
    const actionSrc = actionPool.slice(0, 3).map(a => clipSentence(a, 120));
    const challengeItems = [
      ...problemSrc.map((p, i) => refItem(`Problem ${pad(i + 1)}`, p)),
      ...actionSrc.map((a, i) => refItem(`Action ${pad(i + 1)}`, a)),
    ];
    if (challengeItems.length) {
      slides.push({
        layout: 'narrative-challenge',
        sectionLabel: label,
        title: `${pname} · 문제와 해결`,
        items: challengeItems,
      });
    }

    // 5-3) 성과
    // items → KEY DELIVERABLES (results)
    // bullets → GROWTH POINTS (learning 우선, 없으면 actions/bullets)
    const deliverables = results.slice(0, 4).map(r => clipSentence(r, 90));  // 완전한 문장 우선 (fit:shrink 가 축소)
    const growthSrc = learnings.length ? learnings : (actions.length ? actions : projBullets);
    const growthPoints = growthSrc.slice(0, 3).map(a => clipSentence(a, 120));
    if (deliverables.length || growthPoints.length) {
      slides.push({
        layout: 'narrative-results',
        sectionLabel: label,
        title: `${pname} · 성과`,
        items: deliverables.map(r => refItem(r, '')),
        bullets: growthPoints,  // GROWTH POINTS 전용 — items 와 분리하여 sanitize 오버필터 방지
        metrics: (proj.metrics || []).slice(0, 4),
      });
    }
  });

  // 6) Awards — 있을 때만
  if (awards.length) {
    slides.push({
      layout: 'narrative-awards',
      sectionLabel: 'Awards & Recognition',
      title: '수상 및 활동 성과',
      items: awards.slice(0, 5),
    });
  }

  // 7) Growth — 경험이 2개 이상일 때만
  if (projects.length >= 2) {
    slides.push({
      layout: 'narrative-timeline',
      sectionLabel: 'Growth Curve',
      title: '경험이 이어져 온 흐름',
      items: projects.map(exp => refItem(
        exp.heading,
        stripPlaceholder(exp.body) || exp.bullets?.[0] || stripPlaceholder(exp.role),
        stripPlaceholder(exp.period) || stripPlaceholder(exp.role) || '',
      )),
      subtitle: '',
    });
  }

  // 8) Vision/Roadmap — 목표 데이터가 있을 때만
  if (goals.length) {
    slides.push({
      layout: 'narrative-roadmap',
      sectionLabel: 'Vision',
      title: '입사 후 기여 방향',
      items: goals.slice(0, 3),
      subtitle: '',
    });
  }

  // 9) Closing
  slides.push({
    layout: 'narrative-closing',
    sectionLabel: 'Thank You',
    title: '감사합니다',
    subtitle: `${userName}${coverSubtitle ? ` — ${coverSubtitle} 지원` : ''}`,
    bullets: portfolioContactBullets(ctx),
    items: skillGroups.slice(0, 6).map(g => refItem(`#${g.heading.replace(/\s+/g, '')}`, g.heading)),
  });

  return normalizeReferenceSlides(slides);
}

function buildCaseStudyReferenceDeck(ctx) {
  const userName = ctx.userName || 'Kim Yushin';
  const target = ctx.target || ctx.portfolio?.headline || ctx.portfolio?.title || 'Full-Stack Developer';
  const projectA = ctx.expAt(0);
  const projectB = ctx.expAt(1);
  const education = portfolioEducationItems(ctx);
  const awards = portfolioAwardItems(ctx);
  const skillGroups = portfolioSkillGroups(ctx);
  const goals = portfolioGoalItems(ctx);
  const pName = (exp, fb) => (exp.heading && !/^경험|^대표/.test(exp.heading)) ? exp.heading : fb;
  const pBody = (exp, fb) => exp.body || exp.bullets?.[0] || fb;
  const pPeriod = (exp, fb) => exp.period || fb;
  const pRole = (exp, fb) => exp.role || fb;

  const slides = [
    {
      layout: 'cs-cover',
      sectionLabel: 'TECHNICAL CASE STUDY',
      title: ctx.portfolio?.headline || `사용자 경험을 기술로 설계하는\n${target}, ${userName}`,
      subtitle: '단순 구현을 넘어 최적의 의사결정으로 문제를 해결합니다.',
      bullets: [userName, target],
    },
    {
      layout: 'cs-contents',
      title: 'Contents',
      items: [
        refItem('Profile & Philosophy', '개발 철학과 배경 소개'),
        refItem('Core Competencies', '풀스택, AI 연동, DevOps 역량 요약'),
        refItem(`Deep Dive: Project ${pName(projectA, 'PROJECT A')}`, pBody(projectA, 'AI 기반 포트폴리오 자동 생성 플랫폼')),
        refItem(`Deep Dive: Project ${pName(projectB, 'PROJECT B')}`, pBody(projectB, 'Google Gemini AI 기반 JD 자동 생성 플랫폼')),
        refItem('Technical Excellence', 'Boilerplate & Optimization'),
        refItem('Growth Narrative', '단계별 성장 곡선과 여정 요약'),
      ],
    },
    {
      layout: 'cs-profile',
      title: '"왜(Why)"를 고민하고\n"어떻게(How)"를 증명합니다.',
      subtitle: 'PHILOSOPHY',
      body: '기술은 수단일 뿐, 본질은 사용자의 문제를 해결하는 것입니다.',
      bullets: ['비즈니스 요구사항을 기술적 언어로 번역하고 구현하는 가교 역할을 지향하며, 최적의 사용자 경험을 위해 끊임없이 고민합니다.'],
      items: (education.length ? education.slice(0, 1).map(e => ({ ...e, role: '🎓' })) : [refItem('가천대학교 컴퓨터공학과', '2021.03 ~ 재학 중', '', '🎓')]).concat(
        awards.length ? awards.slice(0, 2).map(a => ({ ...a, role: '🏆' })) : [
          refItem('GCSC 대상 수상', '구글 학생 개발자 커뮤니티 최고상', '', '🏆'),
          refItem('창업경진대회 최우수상', '실제 서비스 기획 및 개발 역량 인정', '', '🥇'),
        ]
      ),
    },
    {
      layout: 'cs-competencies',
      title: 'Core Competencies',
      items: [
        refItem('Full-stack Architecture', 'React/Node.js 기반의 Stateless 인증 아키텍처 설계 및 구현 가능.', '', '≡', ['React', 'Node.js', 'JWT', 'Zustand']),
        refItem('AI API Integration', 'LLM API(Gemini, OpenAI)를 활용한 실전 서비스 파이프라인 구축 경험.', '', '⚙️', ['Gemini API', 'Prompt Eng.', 'Firebase']),
        refItem('DevOps & DX Optimization', 'CI/CD 자동화 및 개발자 경험(DX) 향상을 위한 표준 환경 구축.', '', '>_', ['Vite', 'Vercel', 'ESLint', 'CI/CD']),
      ],
    },
    {
      layout: 'cs-project',
      sectionLabel: 'DEEP DIVE 01',
      title: `${pName(projectA, 'POPOL')}: ${pBody(projectA, 'AI 기반 포트폴리오 자동 생성 플랫폼')}`,
      items: [
        refItem('CONTEXT', pBody(projectA, '취업 준비생의 파편화된 경험 데이터를 AI로 분석하여 직무 맞춤형 포트폴리오와 자기소개서를 자동으로 생성하는 플랫폼')),
        refItem('ROLE', pRole(projectA, '1인 개발 (아키텍처 설계, 프론트엔드/백엔드 개발, 데이터 파이프라인 구축)')),
        refItem('PERIOD', pPeriod(projectA, '2026.04 (1 Month)')),
        refItem('Frontend', 'React · Vite · Zustand · TailwindCSS'),
        refItem('Backend', 'Node.js · Express · JWT · Axios'),
        refItem('Infrastructure', 'Firebase Auth · Firestore · Vercel'),
      ],
    },
    {
      layout: 'cs-problem',
      sectionLabel: `DEEP DIVE 01: ${pName(projectA, 'POPOL')}`,
      title: 'Problem & Technical Constraints',
      subtitle: '파편화된 경험 데이터를 일관된 포트폴리오로 변환하는 높은 허들',
      body: '취업 준비생들은 자신의 다양한 경험을 직무에 맞춰 재구성하는 데 막대한 시간을 소모하며, 이 과정에서 핵심 역량을 효과적으로 추출하지 못하는 문제에 직면해 있습니다.',
      items: [
        refItem('대량 텍스트 분석 처리', '제한된 서버 리소스 내에서 LLM API를 활용하여 수많은 사용자 경험 데이터를 효율적으로 분석하고 큐잉해야 함.', '', '⚙️'),
        refItem('데이터 보안 및 인증 체계', '민감한 개인 경험 데이터를 보호하기 위해 Google OAuth와 연동된 강력하고 확장 가능한 Stateless 인증 체계 필수.', '', '🛡️'),
        refItem('무손실 문서 변환 요구', 'AI가 생성한 결과물을 PDF, Word 등 다양한 포맷으로 변환할 때 레이아웃 깨짐 없는 무손실 Export 기능 구현 필요.', '', '📄'),
      ],
    },
    {
      layout: 'cs-decision',
      sectionLabel: 'DECISION MAKING: ARCHITECTURE',
      title: `${pName(projectA, 'POPOL')} · 왜 Zustand와 JWT인가?`,
      items: [
        refItem('Zustand vs Redux', '1인 개발 환경에서 생산성이 최우선이었습니다. Redux의 복잡한 설정 대신 직관적인 Zustand를 채택하여 핵심 비즈니스 로직 구현에 집중했습니다.', '결과: 코드 복잡도 감소 및 상태 관리 직관성 확보', '결과: 코드 복잡도 감소 및 상태 관리 직관성 확보', ['Boilerplate — Minimal (Zustand)', 'Learning Curve — Low', 'Dev Speed — 2x Faster']),
        refItem('JWT vs Session', '서버의 확장성을 고려하여 Stateless 방식을 선택했습니다. Firebase Admin SDK로 Google OAuth 토큰을 검증하고 자체 JWT를 발행하는 보안 체계를 직접 설계했습니다.', '결과: 서버 부하 최소화 및 독립적 인증 체계 구축', '결과: 서버 부하 최소화 및 독립적 인증 체계 구축', ['Server State — Stateless (JWT)', 'Scalability — High', 'Auth Method — Firebase Admin SDK']),
      ],
    },
    {
      layout: 'cs-execution',
      sectionLabel: 'EXECUTION LOG',
      title: `${pName(projectA, 'POPOL')} · AI 분석 파이프라인 구축 과정`,
      items: [
        refItem('데이터 정규화 및 스키마 설계', '사용자 경험 데이터를 AI가 이해하기 쉬운 구조로 변환하기 위해 JSON Schema를 설계하고 입력 데이터를 정규화했습니다.', '', 'STEP 01'),
        refItem('Node.js 서버 요청 큐잉 처리', '대량의 AI API 요청 시 서버 부하를 방지하고 안정적인 응답을 보장하기 위해 백엔드에서 요청 큐잉 시스템을 구축했습니다.', '', 'STEP 02'),
        refItem('Optimistic UI 기반 실시간 반영', 'AI 분석 중에도 사용자가 대기 시간을 지루하게 느끼지 않도록 비동기 처리 결과를 클라이언트에 즉시 반영하는 UI를 구현했습니다.', '', 'STEP 03'),
        refItem('TROUBLESHOOTING', '외부 AI API의 간헐적인 응답 지연으로 인한 Request Timeout 발생\n\n1. 지수 백오프(Exponential Backoff) 기반 재시도 로직 구현\n2. 사용자에게 명확한 에러 핸들링 메시지 및 상태 피드백 제공', '', 'ISSUE+SOLUTION'),
      ],
    },
    {
      layout: 'cs-results',
      sectionLabel: 'RESULT & IMPACT',
      title: `${pName(projectA, 'POPOL')} · 문서 작성 시간 70% 단축 및 AI 엔진 상용화 수준 구현`,
      metrics: [refMetric('Time Reduction', '70%', '평균 포트폴리오 초안 작성 시간 120분에서 30분으로 획기적 단축')],
      bullets: [
        'Google OAuth & JWT Auth System — 보안이 강화된 사용자 인증 및 세션 관리 체계',
        'AI Analysis Pipeline — 비정형 경험 데이터를 정형화된 역량 키워드로 추출하는 엔진',
        'Multi-format Export Module — PDF, Word 등 다양한 문서 포맷으로의 무손실 변환 기능',
        'Optimistic UI Dashboard — 사용자 경험을 극대화한 실시간 상태 반영 대시보드',
      ],
    },
    {
      layout: 'cs-retrospective',
      sectionLabel: `DEEP DIVE 01: ${pName(projectA, 'POPOL')}`,
      title: 'Retrospective & Learning',
      items: [
        refItem('속도와 확장성의 균형', "기술 선택 시 '현재의 개발 속도'와 '미래의 확장성' 사이의 균형 감각을 습득했습니다.", '', '⚖️'),
        refItem('웹 보안의 근본 원리 이해', 'OAuth와 JWT 인증 흐름을 직접 구현하며 Stateless 인증의 보안적 이점과 한계를 깊이 이해했습니다.', '', '🔒'),
        refItem('RDBMS 도입을 통한 데이터 고도화', '현재의 NoSQL 기반 구조에서 더 복잡한 사용자 데이터 관계를 효율적으로 처리하기 위해 RDBMS(PostgreSQL) 도입과 정규화된 스키마 설계를 다음 목표로 설정했습니다.', '', 'NEXT'),
      ],
    },
    {
      layout: 'cs-project',
      sectionLabel: 'DEEP DIVE 02',
      title: `${pName(projectB, 'WINNOW')}: ${pBody(projectB, 'Google Gemini AI 기반 JD 자동 생성 플랫폼')}`,
      items: [
        refItem('CONTEXT', pBody(projectB, '인사 담당자의 채용 공고 작성 업무 과부하를 해결하기 위해 핵심 키워드만으로 고품질 JD를 자동 생성하고 관리하는 AI 플랫폼')),
        refItem('ROLE', pRole(projectB, '프론트엔드 개발, Google Gemini AI API 연동, Firebase 기반 데이터 관리 및 Vercel 배포 자동화')),
        refItem('PERIOD', pPeriod(projectB, '2026.05 (2 Weeks)')),
        refItem('Frontend & AI', 'Vite · React · Gemini API · Prompt Eng.'),
        refItem('BaaS & Storage', 'Firebase Auth · Firestore'),
        refItem('Deployment', 'Vercel · CI/CD · GitHub Actions'),
      ],
    },
    {
      layout: 'cs-problem',
      sectionLabel: `DEEP DIVE 02: ${pName(projectB, 'WINNOW')}`,
      title: 'Problem & Technical Constraints',
      subtitle: '기업 문화와 직무 특성이 반영된 고품질 JD 생성의 어려움',
      body: '인사 담당자들은 매번 새로운 채용 공고를 작성할 때마다 많은 시간을 소모하며, 단순 키워드만으로는 기업의 색깔이 담긴 전문적인 공고 초안을 작성하는 데 한계를 느끼고 있습니다.',
      items: [
        refItem('AI 생성 결과의 일관성 유지', '다양한 입력값에 대해 항상 전문적이고 일관된 톤앤매너의 채용 공고를 생성할 수 있는 프롬프트 구조 설계 필요.', '', '✏️'),
        refItem('실시간 데이터 및 히스토리 관리', '사용자별로 생성된 수많은 공고 데이터를 실시간으로 저장하고, 언제든지 다시 확인하거나 수정할 수 있는 효율적인 데이터베이스 구조 요구.', '', '🗄️'),
        refItem('극도의 개발 속도 요구', '빠른 시장 검증(MVP)을 위해 인프라 구축 시간을 최소화하고 비즈니스 로직 구현에만 집중할 수 있는 개발 환경 구축 필수.', '', '⚡'),
      ],
    },
    {
      layout: 'cs-decision',
      sectionLabel: 'DECISION MAKING: BAAS & AI',
      title: `${pName(projectB, 'WINNOW')} · Firebase와 Gemini를 통한 빠른 시장 검증`,
      items: [
        refItem('Why Firebase?', '인프라 구축 시간 제로: Auth, DB, Hosting을 통합 관리하여 비즈니스 로직에만 집중. 실시간 데이터 동기화: Firestore를 활용한 실시간 JD 생성 상태 반영.', '결과: 개발 기간 50% 단축 및 안정적인 MVP 런칭', '결과: 개발 기간 50% 단축 및 안정적인 MVP 런칭', ['인프라 구축 시간 제로: Auth, DB, Hosting을 통합 관리', '실시간 데이터 동기화: Firestore를 활용한 실시간 상태 반영', '비용 효율성: 초기 트래픽 대응에 최적화된 종량제 과금 체계']),
        refItem('AI Strategy', 'Gemini 1.5 Flash 채택: 빠른 응답 속도와 높은 한국어 처리 성능 확보. Structured Output: 프롬프트 엔지니어링을 통해 AI 응답을 JSON 포맷으로 강제.', '결과: 일관된 톤앤매너의 고품질 JD 생성 엔진 구현', '결과: 일관된 톤앤매너의 고품질 JD 생성 엔진 구현', ['Gemini 1.5 Flash 채택: 빠른 응답 속도와 한국어 처리 성능', 'Structured Output: AI 응답을 JSON 포맷으로 강제하여 안정성 확보', 'Few-shot Prompting: 고품질 JD 예시를 학습시켜 생성 결과 전문성 향상']),
      ],
    },
    {
      layout: 'cs-execution',
      sectionLabel: 'EXECUTION LOG',
      title: `${pName(projectB, 'WINNOW')} · AI 연동 및 배포 자동화 과정`,
      items: [
        refItem('Gemini API 연동 및 프롬프트 튜닝', 'Google Gemini API를 연동하고, 채용 공고의 전문성을 높이기 위해 수차례의 프롬프트 엔지니어링 및 테스트를 진행했습니다.', '', 'STEP 01'),
        refItem('Firestore 실시간 데이터 바인딩', 'AI가 생성한 JD 데이터를 Firestore에 저장하고, 클라이언트에서 실시간으로 상태를 감지하여 UI에 반영하는 로직을 구현했습니다.', '', 'STEP 02'),
        refItem('Vercel CI/CD 배포 자동화', 'GitHub Actions와 Vercel을 연동하여 코드 푸시 시 자동으로 빌드 및 배포가 이루어지는 파이프라인을 구축했습니다.', '', 'STEP 03'),
        refItem('OPTIMIZATION', "Performance: Vite의 Code Splitting 및 에셋 최적화를 통해 초기 로딩 속도를 40% 개선했습니다.\n\nDX: 공통 UI 컴포넌트의 추상화를 통해 새로운 기능 개발 시 코드 재사용성을 높이고 개발 시간을 단축했습니다.", '', 'PERF+DX'),
      ],
    },
    {
      layout: 'cs-results',
      sectionLabel: 'RESULT & IMPACT',
      title: `${pName(projectB, 'WINNOW')} · AI 기반 채용 프로세스 혁신 및 업무 효율성 극대화`,
      metrics: [refMetric('Efficiency Gain', '80%', '평균 채용 공고(JD) 초안 작성 시간 60분에서 10분으로 획기적 단축')],
      bullets: [
        'Gemini AI Engine Integration — 고품질 JD 생성을 위한 최적화된 프롬프트 파이프라인',
        'Firebase Real-time Architecture — Firestore를 활용한 실시간 데이터 저장 및 사용자 히스토리 관리',
        'Vercel CI/CD Automation — GitHub Actions 연동을 통한 자동 빌드 및 배포 체계 구축',
        'Responsive Admin Dashboard — 인사 담당자를 위한 직관적인 JD 관리 및 편집 인터페이스',
      ],
    },
    {
      layout: 'cs-retrospective',
      sectionLabel: `DEEP DIVE 02: ${pName(projectB, 'WINNOW')}`,
      title: 'Retrospective & Learning',
      items: [
        refItem('비즈니스 가치 중심의 기술 선택', '빠른 시장 검증을 위해 BaaS(Firebase)를 선택하며, 기술적 화려함보다 비즈니스 임팩트가 우선임을 배웠습니다.', '', '💡'),
        refItem('AI 프롬프트 엔지니어링의 힘', '정교한 프롬프트 설계가 AI 모델의 성능을 극대화하고 서비스의 품질을 결정짓는 핵심 요소임을 체감했습니다.', '', '✏️'),
        refItem('사용자 피드백 기반 AI 모델 고도화', '생성된 JD에 대한 인사 담당자들의 수정 이력을 데이터화하여, AI 모델을 미세 조정(Fine-tuning)하거나 RAG를 도입해 기업별 맞춤형 JD 생성 기능을 강화할 계획입니다.', '', 'NEXT'),
      ],
    },
    {
      layout: 'cs-technical',
      sectionLabel: 'TECHNICAL EXCELLENCE',
      title: 'Boilerplate & DX: 개발 생산성의 극대화',
      items: [
        refItem('Vite + React + TypeScript', '빠른 빌드 속도와 타입 안정성을 보장하는 현대적인 프론트엔드 스택 표준화.', '', '🔷'),
        refItem('TailwindCSS & Headless UI', '디자인 시스템의 일관성을 유지하면서도 유연한 UI 개발이 가능한 환경 구축.', '', '✏️'),
        refItem('Zustand State Management', '복잡한 보일러플레이트 없이 직관적인 전역 상태 관리 패턴 적용.', '', '🗄️'),
        refItem('Linting & Formatting', 'ESLint와 Prettier 설정을 통해 코드 품질을 자동화하고 일관된 스타일 유지.', '', '✏️'),
        refItem('CI/CD Automation', 'GitHub Actions와 Vercel을 연동하여 코드 푸시 시 자동 빌드 및 배포 환경 구축.', '', '🔄'),
        refItem('Standardized README', '프로젝트 구조와 실행 방법을 명확히 문서화하여 협업 효율성 증대.', '', '📋'),
      ],
      metrics: [refMetric('Setup Efficiency Impact', '4 Hours → 10 Minutes', '')],
    },
    {
      layout: 'cs-skillmap',
      sectionLabel: 'TECHNICAL SUMMARY',
      title: 'Skill Map: 기술적 깊이와 넓이의 조화',
      items: [
        refItem('Frontend', 'React / Vite — 컴포넌트 기반 설계 및 최적화된 빌드 환경 구축\nZustand — 가벼운 전역 상태 관리 및 데이터 흐름 설계\nTailwindCSS — 유틸리티 우선 방식의 빠른 UI 프로토타이핑', '', '🖥️'),
        refItem('Backend', 'Node.js / Express — RESTful API 설계 및 비동기 로직 처리\nJWT / Auth — Stateless 인증 체계 및 보안 프로토콜 구현\nFirebase Admin — BaaS 연동 및 서버 측 권한 관리', '', '🗄️'),
        refItem('AI & Data', 'Gemini / OpenAI — LLM API 연동 및 서비스 파이프라인 구축\nPrompt Eng. — 생성 결과 최적화를 위한 프롬프트 설계\nFirestore / NoSQL — 유연한 데이터 모델링 및 실시간 동기화', '', '🤖'),
        refItem('DevOps', 'Vercel / CI/CD — 자동 배포 파이프라인 및 환경 설정\nGit / GitHub — 버전 관리 및 협업 워크플로우 숙달\nDX Tools — ESLint, Prettier 등 개발 생산성 도구', '', '🔧'),
      ],
    },
    {
      layout: 'cs-journey',
      sectionLabel: 'GROWTH NARRATIVE',
      title: 'The Journey: 성장의 궤적',
      subtitle: '단순히 코드를 쓰는 개발자를 넘어, 기술로 비즈니스 문제를 해결하고 사용자에게 가치를 전달하는 파트너로 성장하고 있습니다.',
      items: [
        refItem('문제의 발견', "주변의 불편함을 기술로 해결할 수 있을까라는 호기심에서 시작된 개발의 여정. 사용자의 목소리에 귀 기울이는 법을 배웠습니다.", '', 'PHASE 01'),
        refItem('기술적 증명', `${pName(projectA, 'POPOL')} 프로젝트를 통해 복잡한 아키텍처를 설계하고 구현하며, 풀스택 개발자로서의 기술적 근육을 키웠습니다.`, '', 'PHASE 02'),
        refItem('비즈니스 임팩트', `${pName(projectB, 'WINNOW')} 프로젝트를 통해 AI 기술을 비즈니스 가치로 치환하며, '팔리는 기술'과 '효율'의 중요성을 깨달았습니다.`, '', 'PHASE 03'),
      ],
    },
    {
      layout: 'cs-contribution',
      sectionLabel: 'NEXT CONTRIBUTION',
      title: 'Ready to Impact: 준비된 역량으로 기여하겠습니다',
      items: [
        refItem('비즈니스 중심 문제 해결', '단순한 기능 구현을 넘어, 비즈니스 목표를 이해하고 기술적 의사결정을 통해 실질적인 가치를 창출하는 개발자가 되겠습니다.', 'Business Value First', 'Business Value First'),
        refItem('AI 기술의 실전 서비스화', '최신 AI 기술(LLM)을 서비스에 녹여내어 사용자 경험을 혁신하고, 내부 업무 프로세스의 효율성을 극대화하겠습니다.', 'AI-Driven Innovation', 'AI-Driven Innovation'),
        refItem('지속 가능한 협업과 성장', '유지보수가 용이한 클린 코드를 지향하며, 팀의 생산성을 높이는 보일러플레이트와 DX 개선에 기여하겠습니다.', 'Sustainable Growth', 'Sustainable Growth'),
      ],
    },
    {
      layout: 'cs-closing',
      title: '함께 성장하며\n새로운 가치를 만들어가고 싶습니다.',
      bullets: portfolioContactBullets(ctx).length ? portfolioContactBullets(ctx) : [
        `${userName.toLowerCase().replace(/\s+/g, '.')}.kim@example.com`,
        `github.com/${userName.toLowerCase().replace(/\s+/g, '-')}`,
        'fitpoly.kr/p/...',
      ],
    },
  ];
  return normalizeReferenceSlides(slides);
}

function expandAcceptedDeckToThirty(slides, ctx, mode) {
  const result = slides.slice(0, 30).map((slide, index) => ({ ...slide, id: 's' + (index + 1) }));
  const closing = result.find(slide => slide.layout === 'closing' || slide.proposalVariant === 'closing') || buildClosingSlide(ctx, 's30');
  const withoutClosing = result.filter(slide => !(slide.layout === 'closing' || slide.proposalVariant === 'closing'));
  const pool = withoutClosing.length ? withoutClosing : result;
  let cursor = 0;
  while (withoutClosing.length < 29) {
    withoutClosing.push(buildAcceptedExpansionSlide(ctx, mode, withoutClosing.length + 1, pool[cursor % pool.length] || {}));
    cursor += 1;
  }
  return [...withoutClosing.slice(0, 29), { ...closing, id: 's30', sectionLabel: closing.sectionLabel || 'Closing' }]
    .map((slide, index) => ({ ...slide, id: 's' + (index + 1) }));
}

// proposal 모드 패딩 슬라이드에서 사용할 변형 풀.
// Why: buildProposalDeckFromPortfolio가 contents/threeCards/timeline/darkStats/splitPhotoList/
// stairSteps/venn/metricBars/conditionGrid/gantt/promise 를 이미 슬라이드 1~14에 사용함.
// 슬라이드 15~29 패딩은 사용자가 보낸 30장 이미지에서 아직 매핑 안 된 다른 디자인 풀로 채움.
const PROPOSAL_EXPANSION_VARIANTS = [
  'bubbleCore', 'comparison', 'graphCallout', 'synergy', 'roleTable',
  'targetCircle', 'caseGrid', 'testimonial', 'criteria', 'stageCards',
  'pyramid', 'budget', 'risk', 'orbit', 'faqCards',
];

function buildAcceptedExpansionSlide(ctx, mode, number, source = {}) {
  const exp = ctx.expAt(number);
  const metric = ctx.metricPool[number % Math.max(1, ctx.metricPool.length)] || ctx.firstMetric;
  const modeLabel = {
    narrative: 'Story Evidence',
    star: 'STAR Evidence',
    'kpi-dashboard': 'KPI Evidence',
    timeline: 'Timeline Evidence',
    'case-study': 'Case Evidence',
    proposal: '제안 자료',
  }[mode] || 'Portfolio Evidence';
  const sectionLabels = mode === 'proposal' ? [
    '핵심 강점', '차이점', '경험 기반 전략', '협업 시너지', '역할 분담',
    '공동 목표', '대표 사례', '추천 신뢰', '평가 기준', '단계별 운영',
    '서비스 지향점', '예산 구성', '리스크 대응', '협력 체계', '서비스 안내',
  ] : [
    'Opening Signal', 'Context', 'Problem', 'Decision', 'Execution', 'Evidence',
    'Impact', 'Learning', 'Fit', 'Collaboration', 'Risk', 'Next Move',
    'Metric Proof', 'User Insight', 'Role Scope', 'Before / After', 'Process Log',
    'Result Detail', 'Skill Match', 'Interview Hook', 'Growth Point', 'Case Note',
    'KPI Trace', 'Roadmap', 'Final Proof',
  ];
  const label = sectionLabels[(number - 1) % sectionLabels.length];
  const heading = exp.heading || source.title || (mode === 'proposal' ? '대표 경험' : 'Representative Experience');
  const bullets = ctx.pickBullets([
    exp.problem?.[0] || exp.body || (mode === 'proposal' ? '해결할 문제를 명확히 정의합니다' : 'Define the problem clearly'),
    exp.action?.[0] || (mode === 'proposal' ? '실행 방식과 의사결정 경로를 설명합니다' : 'Explain the decision and execution path'),
    exp.result?.[0] || (mode === 'proposal' ? '결과를 직무 적합성과 연결합니다' : 'Connect the result to role fit'),
    ctx.strengths[number % Math.max(1, ctx.strengths.length)] || (mode === 'proposal' ? '반복 가능한 강점' : 'Show repeatable working style'),
  ]);

  const isProposalMode = mode === 'proposal';
  const bodyVariant = isProposalMode
    ? PROPOSAL_EXPANSION_VARIANTS[(number - 1) % PROPOSAL_EXPANSION_VARIANTS.length]
    : (['', 'proof', 'quote', 'map', 'signal', 'snapshot'])[number % 6];

  const titlePatterns = isProposalMode ? [
    `${label}을(를) 한눈에 보여드립니다`,
    `${heading}에서 확인된 ${label}`,
    `${ctx.target || '지원 직무'}에서 검증된 ${label}`,
    `${label} · 경험 기반으로 정리한 ${ctx.userName}의 강점`,
  ] : [
    `${label}: ${heading}`,
    `${heading}에서 확인된 ${label}`,
    `${modeLabel} ${String(number).padStart(2, '0')}`,
    `${ctx.target || '지원 직무'} 관점의 ${label}`,
  ];

  const variantData = isProposalMode
    ? buildProposalExpansionData(bodyVariant, ctx, exp, metric, bullets, heading)
    : null;

  return {
    id: 's' + number,
    layout: 'proposal',
    sectionLabel: label,
    proposalVariant: bodyVariant,
    dark: ['darkStats', 'budget'].includes(bodyVariant),
    title: titlePatterns[number % titlePatterns.length],
    subtitle: `${modeLabel} · ${ctx.userName}`,
    bullets: (variantData && variantData.bullets) || bullets.slice(0, 4),
    metrics: (variantData && variantData.metrics) || (metric ? [metric] : []),
    items: (variantData && variantData.items) || [
      { heading: exp.heading || label, role: exp.role || ctx.target || modeLabel, period: exp.period || '', body: exp.body || bullets[0] || '', bullets: bullets.slice(0, 3), metrics: exp.metrics || [] },
      { heading: 'Problem', body: exp.problem?.[0] || bullets[0] || '해결해야 할 문제와 맥락을 정의합니다' },
      { heading: 'Action', body: exp.action?.[0] || bullets[1] || '문제 해결을 위한 구체적 실행 방식을 정리합니다' },
      { heading: 'Result', body: exp.result?.[0] || bullets[2] || '결과와 배운 점을 증거 중심으로 정리합니다' },
    ],
    table: variantData && variantData.table,
  };
}

// 각 proposal 변형에 필요한 items/bullets/metrics/table 구조를 ctx로부터 빌드.
// 사용자가 첨부한 30장 제안서 이미지의 비주얼 다양성을 슬라이드 15~29에 재현.
function buildProposalExpansionData(variant, ctx, exp, metric, bullets, heading) {
  const userName = ctx.userName || '지원자';
  const target = ctx.target || '지원 직무';
  const strengths = ctx.strengths || [];
  const expItems = ctx.expItems || [];

  switch (variant) {
    case 'bubbleCore':
      return {
        bullets: (strengths.length ? strengths : ['전문성 기반 실행력', '안정적 운영 체계', '협업과 성장 기반']).slice(0, 3),
      };
    case 'comparison':
      return {
        items: [
          { heading: '도입 전', body: exp.problem?.[0] || '초기 문제와 우선순위가 명확하지 않은 상황' },
          { heading: '도입 후', body: exp.result?.[0] || exp.action?.[0] || '체계적 실행으로 측정 가능한 결과 도출' },
        ],
      };
    case 'graphCallout':
      return {
        bullets: [
          exp.body || bullets[0] || `${userName}의 경험 기반 전략으로 빠른 성장 가능성을 제시합니다`,
          ...bullets.slice(0, 3),
        ],
      };
    case 'synergy':
      return {
        items: (strengths.length >= 4 ? strengths.slice(0, 4) : ['전문 역량', '실행 속도', '협업 시너지', '성과 창출'])
          .map(t => ({ heading: typeof t === 'string' ? t.split('·')[0].trim() : t })),
      };
    case 'roleTable':
      return {
        table: [
          ['기간', '단계', userName, target],
          ['Phase 1', '준비', '강점·경험 분석', '요구사항 정리'],
          ['Phase 2', '실행', '맞춤 실행 계획', '실행 검토'],
          ['Phase 3', '확장', '성과 도출', '결과 검증'],
          ['Phase 4', '완성', '안정화 및 인수인계', '최종 합의'],
        ],
      };
    case 'targetCircle':
    case 'orbit':
      return {
        items: [
          { heading: userName, body: '강점 기반의 실행 경험' },
          { heading: '공동 목표', body: '직무 적합성과 성과 창출' },
          { heading: target, body: '핵심 역량 요구와 기대 성과' },
          { heading: '연결 포인트', body: '경험에서 검증된 역량' },
        ],
      };
    case 'caseGrid': {
      const cases = (expItems.length ? expItems : [
        { heading: '대표 사례', body: '핵심 경험과 직무 연결' },
        { heading: '주요 성과', body: '수치 기반 결과 정리' },
        { heading: '협업 경험', body: '팀 시너지와 기여' },
        { heading: '성장 사례', body: '학습과 적용의 반복' },
      ]).slice(0, 4);
      return {
        items: cases.map(e => ({
          heading: e.heading || '대표 사례',
          body: e.body || e.bullets?.[0] || '경험에서 확인된 성과와 역할',
        })),
      };
    }
    case 'testimonial':
      return {
        bullets: [
          strengths[0] || '직무 적합도 높은 경험 정리',
          strengths[1] || '신속한 실행과 협업 역량',
          strengths[2] || '체계적인 결과 검증과 학습',
        ],
      };
    case 'criteria':
      return {
        items: [
          { heading: '검증된 전문성', body: '직무 이해를 바탕으로 한 실행 경험' },
          { heading: '광범위한 경험', body: `${expItems.length || 1}건의 대표 경험과 사례 보유` },
          { heading: '안정적 운영 체계', body: '체계적 프로세스와 명확한 기준 적용' },
          { heading: '지속 성장', body: '경험에서 배운 것을 반복 적용하며 성장' },
        ],
      };
    case 'stageCards':
      return {
        items: [
          { heading: '준비', body: '요구사항 분석과 전략 수립' },
          { heading: '실행 시작', body: '핵심 영역 우선 적용' },
          { heading: '운영', body: '체계적 프로세스 유지' },
          { heading: '검증', body: '성과 점검과 피드백' },
          { heading: '확장', body: '안정적 결과로 영역 확대' },
        ],
      };
    case 'pyramid':
      return {
        items: [
          { heading: 'BASE', body: '전문 수행 기반 — 검증된 경험과 안정적 운영' },
          { heading: 'MATCH', body: '정확한 매칭 — 직무 요구와 강점 연결' },
          { heading: 'RESULT', body: '성과 창출 — 측정 가능한 결과 실현' },
        ],
      };
    case 'budget':
      return {
        items: [
          { heading: '45%', body: '핵심 역량 영역' },
          { heading: '35%', body: '실행 및 운영 지원' },
          { heading: '10%', body: '평가 및 검증' },
          { heading: '10%', body: '기타 운영' },
        ],
      };
    case 'risk':
      return {
        items: [
          { heading: '일정 지연', body: '예상 원인과 사전 대응 시나리오 정리' },
          { heading: '리소스 부족', body: '예상 원인과 사전 대응 시나리오 정리' },
          { heading: '결과 미달', body: '예상 원인과 사전 대응 시나리오 정리' },
        ],
      };
    case 'faqCards':
      return {
        items: [
          { heading: '서비스 기간', body: '기본 계약 기간은 1년 단위로 운영하며 협의 후 연장 가능합니다' },
          { heading: '초기 비용', body: '서비스 범위와 규모에 따라 합리적인 기준으로 산정됩니다' },
          { heading: '계약 후 시작', body: '계약 체결 후 1~2주 내 본격 운영을 시작합니다' },
          { heading: '추가 문의', body: '전담 담당자를 통해 상시 문의 및 안내가 가능합니다' },
        ],
      };
    default:
      return null;
  }
}
function normalizeExperiences(p) {
  const source = Array.isArray(p.experiences) ? p.experiences : [];
  return source.map((e, idx) => {
    const sr = e.structuredResult || e.frameworkContent || {};
    const ov = sr.projectOverview || {};
    const exportConfig = sr.exportConfig || e.exportConfig || {};
    const sections = Array.isArray(exportConfig.sections) && exportConfig.sections.length
      ? exportConfig.sections
      : (Array.isArray(e.sections) ? e.sections : []);
    const keyExperiences = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : (Array.isArray(e.keyExperiences) ? e.keyExperiences : []);
    const compact = (value, max = 95) => sanitizePortfolioText(String(value || '')).replace(/\s+/g, ' ').trim().slice(0, max);
    const bullets = [
      ...(Array.isArray(e.bullets) ? e.bullets : []),
      ...sections.map(s => s.content || s.title).filter(Boolean),
      ...keyExperiences.map(k => k.result || k.action || k.title).filter(Boolean),
    ].map(v => compact(v, 95)).filter(Boolean).slice(0, 6);
    const metrics = keyExperiences
      .map(k => ({ label: compact(k.metricLabel || k.title, 34), value: compact(k.metric, 26), before: compact(k.beforeMetric, 18), after: compact(k.afterMetric, 18) }))
      .filter(m => m.label || m.value || (m.before && m.after))
      .slice(0, 4);
    const keywords = [
      ...(Array.isArray(e.keywords) ? e.keywords : []),
      ...(Array.isArray(sr.keywords) ? sr.keywords : []),
    ];
    return {
      heading: compact(e.company || e.title || ov.projectName || `경험 ${idx + 1}`, 54),
      period: compact(ov.duration || e.period, 36),
      role: compact(ov.role || e.role || sr.jobCategory, 48),
      body: compact(e.description || sr.intro || sr.overview || ov.summary || e.detail || bullets[0], 160),
      bullets,
      metrics,
      keywords,
      // 추출 스키마의 실제 필드는 context (situation 은 구버전 호환). problem 이 비던 핵심 버그.
      // 캡 150 — 완전한 문장이 중간에 안 잘리도록 충분히 확보 (표시 맞춤은 clipSentence + PPTX fit:shrink).
      problem: keyExperiences.map(k => compact(k.context || k.situation || k.problem, 150)).filter(Boolean).slice(0, 3),
      action: keyExperiences.map(k => compact(k.action, 150)).filter(Boolean).slice(0, 3),
      result: keyExperiences.map(k => compact(k.result, 150)).filter(Boolean).slice(0, 3),
      learning: keyExperiences.map(k => compact(k.learning, 150)).filter(Boolean).slice(0, 3),
    };
  }).filter(e => e.heading || e.bullets.length || e.metrics.length);
}

function deriveStrengths(experiences, p) {
  const skills = p.skills || {};
  const skillBullets = [['languages', '언어'], ['frameworks', '프레임워크'], ['tools', '도구'], ['others', '기타']]
    .map(([key, label]) => {
      const arr = Array.isArray(skills[key]) ? skills[key] : [];
      const names = arr.slice(0, 5).map(v => typeof v === 'string' ? v : v.name).filter(Boolean).join(', ');
      return names ? `${label} · ${names}` : '';
    }).filter(Boolean);
  const experienceStrengths = experiences.flatMap(e => [
    e.role && `${e.role} 역할 수행`,
    e.metrics[0] && `${e.metrics[0].label || '성과'} 기반 문제 해결`,
    e.keywords[0] && `${e.keywords[0]} 관련 실무 경험`,
  ]).filter(Boolean);
  return [...skillBullets, ...experienceStrengths].slice(0, 8);
}

function splitSentences(value, limit = 5) {
  return String(value || '').split(/[.!?。\n]+/).map(s => s.trim()).filter(Boolean).slice(0, limit);
}

function buildDeckFromPortfolio(p) {
  const slides = [];
  const userName = sanitizePortfolioText(p.userName) || '';
  const target = `${sanitizePortfolioText(p.targetCompany) || ''} ${sanitizePortfolioText(p.targetPosition) || ''}`.trim();

  slides.push({ id: 's1', layout: 'cover', title: p.title || `${userName} 포트폴리오`, subtitle: target || (p.headline || '') });

  const profileBullets = [
    userName && `이름 · ${userName}`,
    p.userBirth && `생년 · ${p.userBirth}`,
    p.userAddress && `거주 · ${p.userAddress}`,
    p.contact?.email && `Email · ${p.contact.email}`,
    p.contact?.phone && `Phone · ${p.contact.phone}`,
    (p.contact?.website || p.contact?.linkedin) && `Web · ${p.contact.website || p.contact.linkedin}`,
  ].filter(Boolean);
  if (profileBullets.length) slides.push({ id: `s${slides.length + 1}`, layout: 'profile', title: 'Profile', subtitle: target, bullets: profileBullets });

  const education = Array.isArray(p.education) ? p.education : [];
  if (education.length) {
    slides.push({
      id: `s${slides.length + 1}`, layout: 'education', title: 'Education',
      items: education.slice(0, 3).map(e => ({ heading: e.school || e.name || '', period: e.period || '', role: e.degree || e.major || '', body: e.major || e.description || '', bullets: Array.isArray(e.bullets) ? e.bullets : [], metrics: [] })),
    });
  }

  const experiences = Array.isArray(p.experiences) ? p.experiences : [];
  experiences.slice(0, 6).forEach((e, idx) => {
    const sr = e.structuredResult || e.frameworkContent || {};
    const ov = sr.projectOverview || {};
    const heading = e.company || e.title || `프로젝트 ${idx + 1}`;
    const period = ov.duration || e.period || '';
    const role = ov.role || e.role || '';
    const body = e.description || sr.intro || sr.overview || ov.summary || e.detail || '';
    let itemBullets = [];
    if (Array.isArray(e.bullets) && e.bullets.length) itemBullets = e.bullets.slice(0, 5);
    else if (Array.isArray(e.sections)) itemBullets = e.sections.slice(0, 4).map(s => s.title || s.content).filter(Boolean);
    const keyExps = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
    const metrics = keyExps.slice(0, 3).map(k => ({ label: k.metricLabel || k.title || '', value: k.metric || '', before: k.beforeMetric || '', after: k.afterMetric || '' })).filter(m => m.label || m.value);
    if (!itemBullets.length && keyExps.length) itemBullets = keyExps.slice(0, 4).map(k => k.result || k.action || k.title).filter(Boolean);
    const compact = (s, max = 80) => sanitizePortfolioText(String(s || '')).replace(/\s+/g, ' ').trim().slice(0, max);
    const problem = keyExps.map(k => compact(k.context || k.situation || k.problem)).filter(Boolean).slice(0, 3);
    const action = keyExps.map(k => compact(k.action)).filter(Boolean).slice(0, 3);
    const result = keyExps.map(k => compact(k.result)).filter(Boolean).slice(0, 3);
    if (!problem.length && !action.length && !result.length && itemBullets.length) {
      itemBullets.slice(0, 3).forEach((b, i) => { if (i === 0) problem.push(compact(b)); else if (i === 1) action.push(compact(b)); else result.push(compact(b)); });
    }
    const highlight_metric = metrics[0] || null;
    const totalLen = [...problem, ...action, ...result].join(' ').length;
    const layout_type = highlight_metric && totalLen < 80 ? 'CENTER_METRIC' : highlight_metric && (problem.length || action.length || result.length) ? 'SPLIT_HALF' : 'STACK_LIST';
    slides.push({ id: `s${slides.length + 1}`, layout: 'experience', title: `핵심 경험: ${heading}`, subtitle: role || period, layout_type, highlight_metric, details: { problem, action, result }, items: [{ heading, period, role, body, bullets: itemBullets, metrics }] });
  });

  const skills = p.skills || {};
  const techBullets = [];
  [['languages', 'Languages'], ['frameworks', 'Frameworks'], ['tools', 'Tools'], ['others', 'Others']].forEach(([cat, label]) => {
    const arr = Array.isArray(skills[cat]) ? skills[cat] : [];
    const names = arr.slice(0, 6).map(s => typeof s === 'string' ? s : s.name).filter(Boolean).join(', ');
    if (names) techBullets.push(`${label} · ${names}`);
  });
  if (techBullets.length) slides.push({ id: `s${slides.length + 1}`, layout: 'skills', title: 'Skills', bullets: techBullets });

  const awards = Array.isArray(p.awards) ? p.awards : [];
  if (awards.length) slides.push({ id: `s${slides.length + 1}`, layout: 'awards', title: 'Awards', bullets: awards.slice(0, 6).map(a => typeof a === 'string' ? a : [a.name || a.title, a.issuer, a.date || a.period].filter(Boolean).join(' · ')) });

  const values = p.values || p.valuesEssay || p.about;
  if (values && String(values).trim()) {
    const trimmed = String(values).trim();
    const sentences = trimmed.split(/[.!?。\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 5);
    slides.push({ id: `s${slides.length + 1}`, layout: 'values', title: 'Values', bullets: sentences.length ? sentences : [trimmed.slice(0, 200)] });
  }

  slides.push({ id: `s${slides.length + 1}`, layout: 'closing', title: 'Thank You', subtitle: userName, bullets: [p.contact?.email && `Email · ${p.contact.email}`, p.contact?.phone && `Phone · ${p.contact.phone}`, p.contact?.website && `Web · ${p.contact.website}`].filter(Boolean) });

  return { meta: { title: p.title || `${userName} 포트폴리오`, subtitle: target, accentColor: '#0F172A' }, slides };
}

function mergeDecksWithPolish(baseDeck, polished) {
  if (!polished || !Array.isArray(polished.slides)) return baseDeck;
  const byId = new Map();
  polished.slides.forEach((s, i) => byId.set(s.id || `s${i + 1}`, s));
  const slides = baseDeck.slides.map(b => {
    const p = byId.get(b.id);
    if (!p) return b;
    const mergedBullets = Array.isArray(p.bullets) && p.bullets.length ? p.bullets.map(x => String(x).slice(0, 120)).slice(0, 8) : b.bullets || [];
    const mergedItems = Array.isArray(p.items) && p.items.length ? p.items.map((pit, idx) => {
      const bit = (b.items || [])[idx] || {};
      return {
        heading: String(pit.heading || bit.heading || '').slice(0, 60),
        period: String(pit.period || bit.period || '').slice(0, 40),
        role: String(pit.role || bit.role || '').slice(0, 60),
        body: String(pit.body || bit.body || '').slice(0, 200),
        bullets: Array.isArray(pit.bullets) && pit.bullets.length ? pit.bullets.map(x => String(x).slice(0, 120)).slice(0, 6) : (bit.bullets || []),
        metrics: Array.isArray(pit.metrics) && pit.metrics.length ? pit.metrics.slice(0, 4).map(m => ({ label: String(m.label || '').slice(0, 40), value: String(m.value || '').slice(0, 30), before: m.before ? String(m.before).slice(0, 20) : '', after: m.after ? String(m.after).slice(0, 20) : '' })).filter(m => m.label || m.value) : (bit.metrics || []),
      };
    }) : (b.items || []);
    return {
      id: b.id, layout: b.layout,
      sectionLabel: p.sectionLabel || b.sectionLabel || '',
      proposalVariant: p.proposalVariant || b.proposalVariant || '',
      dark: typeof p.dark === 'boolean' ? p.dark : (b.dark || false),
      table: Array.isArray(p.table) ? p.table : (b.table || undefined),
      metrics: Array.isArray(p.metrics) && p.metrics.length ? p.metrics : (b.metrics || undefined),
      title: String(p.title || b.title || '').slice(0, 80),
      subtitle: String(p.subtitle || b.subtitle || '').slice(0, 120),
      bullets: mergedBullets, items: mergedItems,
      layout_type: ['SPLIT_HALF', 'CENTER_METRIC', 'STACK_LIST'].includes(p.layout_type) ? p.layout_type : (b.layout_type || undefined),
      highlight_metric: p.highlight_metric && (p.highlight_metric.value || p.highlight_metric.label) ? { label: String(p.highlight_metric.label || '').slice(0, 30), value: String(p.highlight_metric.value || '').slice(0, 24), before: p.highlight_metric.before ? String(p.highlight_metric.before).slice(0, 16) : '', after: p.highlight_metric.after ? String(p.highlight_metric.after).slice(0, 16) : '' } : (b.highlight_metric || undefined),
      details: p.details && typeof p.details === 'object' ? {
        problem: (Array.isArray(p.details.problem) ? p.details.problem : (b.details?.problem || [])).map(x => String(x).slice(0, 90)).slice(0, 3),
        action: (Array.isArray(p.details.action) ? p.details.action : (b.details?.action || [])).map(x => String(x).slice(0, 90)).slice(0, 3),
        result: (Array.isArray(p.details.result) ? p.details.result : (b.details?.result || [])).map(x => String(x).slice(0, 90)).slice(0, 3),
      } : (b.details || undefined),
      notes: p.notes ? String(p.notes).slice(0, 200) : '',
    };
  });
  return { meta: { ...baseDeck.meta, ...(polished.meta || {}) }, slides };
}
