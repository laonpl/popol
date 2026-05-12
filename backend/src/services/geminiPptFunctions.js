// AI PPT 생성 함수 — geminiService.js 에 re-export 됨
import { buildAiPptAnalyzePrompt, buildAiPptRevisePrompt } from '../prompts/portfolioPrompts.js';

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

export async function generateAiPptDeck({ portfolio, templateHint, customTemplate }) {
  const layoutMode = getPptLayoutMode(templateHint);
  if (customTemplate) {
    try {
      const prompt = buildAiPptAnalyzePrompt({ portfolio, templateHint, customTemplate });
      const text = await withTimeout(callGeminiPro(prompt), 90000);
      const customDeck = parseJSON(text);
      if (customDeck && Array.isArray(customDeck.slides) && customDeck.slides.length > 0) return customDeck;
    } catch (err) {
      console.warn('[AiPptDeck] 커스텀 템플릿 생성 실패 — 결정적 deck 폴백:', err.message);
    }
  }
  const acceptedLayoutDeck = buildAcceptedLayoutDeckFromPortfolio(portfolio, layoutMode);
  if (acceptedLayoutDeck) return acceptedLayoutDeck;

  const useProposalDeck = isProposalTemplateHint(templateHint);
  const baseDeck = useProposalDeck ? buildProposalDeckFromPortfolio(portfolio) : buildDeckFromPortfolio(portfolio);
  if (useProposalDeck) return baseDeck;

  let polished = null;
  try {
    const prompt = buildAiPptAnalyzePrompt({ portfolio, templateHint, baseDeck });
    const text = await withTimeout(callGeminiPro(prompt), 90000);
    polished = parseJSON(text);
  } catch (err) {
    console.warn('[AiPptDeck] AI polish 실패 — 결정적 deck 사용:', err.message);
  }
  return mergeDecksWithPolish(baseDeck, polished);
}

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
  const userName = p.userName || '지원자';
  const targetCompany = p.targetCompany || '';
  const targetPosition = p.targetPosition || '';
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
  const userName = p.userName || '지원자';
  const target = `${p.targetCompany || ''} ${p.targetPosition || ''}`.trim();
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
    p.contact?.website && `Web · ${p.contact.website}`,
    p.contact?.linkedin && `LinkedIn · ${p.contact.linkedin}`,
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

  return { userName, target, experiences, expItems, primary, allMetrics, firstMetric, metricText, keywords, strengths, contactBullets, pickBullets, expAt, expPoint, metricPool };
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
    makeExperienceSlide('s6', '대표 장면', `첫 번째 전환점: ${expAt(0).heading || '대표 경험'}`, expAt(0), '문제 정의에서 실행으로 넘어간 장면'),
    makeExperienceSlide('s7', '대표 장면', `두 번째 전환점: ${expAt(1).heading || '확장 경험'}`, expAt(1), '성과를 재현 가능한 방식으로 확장한 장면'),
    { id: 's8', layout: 'proposal', sectionLabel: '성과 증거', proposalVariant: 'graphCallout', title: '성과는 흐름으로 누적되었습니다', subtitle: '단일 결과가 아니라 문제 해결 범위가 확장된 흔적을 보여줍니다', bullets: pickBullets(['문제 범위 확장', '실행 속도 개선', '협업 품질 향상']) },
    { id: 's9', layout: 'proposal', sectionLabel: '직무 연결', proposalVariant: 'venn', title: '이 스토리가 지원 직무와 만나는 지점입니다', subtitle: '경험의 의미를 회사와 직무의 언어로 번역합니다', items: [
      { heading: `${userName}의 경험`, body: strengths[0] || expPoint(0, '문제 해결 경험') },
      { heading: target || '지원 직무', body: '필요 역량과 역할 기대' },
      { heading: '기여 메시지', body: firstMetric.label ? `${firstMetric.label} 중심의 검증된 실행력` : '성과로 검증한 실행력' },
    ] },
    { id: 's10', layout: 'proposal', sectionLabel: '다음 기여', proposalVariant: 'gantt', title: '입사 후에는 이렇게 확장하겠습니다', subtitle: '합격자 포트폴리오의 마지막은 다짐보다 실행 계획이어야 합니다', items: ['맥락 파악', '대표 경험 적용', '핵심 과제 실행', '성과 회고'].map((heading, i) => ({ heading, role: ['Week 1', 'Week 2-3', 'Week 3-5', 'Week 6+'][i], body: pickBullets()[i] || '업무 기준에 맞춰 실행' })) },
    buildClosingSlide(ctx, 's11'),
  ];
  return finalizeAcceptedDeck({ title: `${userName} 스토리형 포트폴리오`, subtitle: target, accentColor: '#FF4F1A', templateMode: 'accepted-narrative' }, slides, ctx, 'narrative');
}

function buildStarDeckFromPortfolio(p) {
  const ctx = buildDeckContext(p);
  const { userName, target, expItems, firstMetric, metricText, pickBullets, expAt, expPoint } = ctx;
  const slides = [
    { id: 's1', layout: 'cover', title: `${userName} STAT/STAR 포트폴리오`, subtitle: target ? `${target} 맞춤 경험 검증 자료` : '상황·과제·행동·결과 중심 경험 검증 자료', bullets: ['SITUATION', 'TASK', 'ACTION', 'RESULT'] },
    { id: 's2', layout: 'proposal', sectionLabel: '목차', proposalVariant: 'contents', title: 'STAR 검증 순서', items: [
      { heading: '핵심 역량', role: 'Signal', body: '먼저 읽히는 강점' },
      { heading: '대표 STAR', role: 'Evidence', body: '경험별 문제와 행동' },
      { heading: '성과 증거', role: 'Result', body: '정량·정성 결과' },
      { heading: '직무 매칭', role: 'Fit', body: '요구 역량과 연결' },
    ] },
    { id: 's3', layout: 'proposal', sectionLabel: 'STAR 요약', proposalVariant: 'conditionGrid', title: '한 장으로 보는 STAR 시그널입니다', subtitle: '면접관이 바로 질문할 수 있도록 경험의 맥락과 결과를 분리합니다', items: [
      { heading: 'Situation', body: expAt(0).problem?.[0] || expPoint(0, '해결해야 할 상황') },
      { heading: 'Task', body: expAt(0).role || '내가 맡은 역할과 책임' },
      { heading: 'Action', body: expAt(0).action?.[0] || expPoint(1, '실행한 핵심 행동') },
      { heading: 'Result', body: firstMetric.label ? `${firstMetric.label} ${metricText(firstMetric)}` : expPoint(2, '변화와 성과') },
    ] },
    { id: 's4', layout: 'proposal', sectionLabel: '경험 매핑', proposalVariant: 'roleTable', title: '경험별 STAR 포인트를 정리했습니다', subtitle: '합격 포트폴리오는 역할과 결과를 같은 표에서 확인할 수 있어야 합니다', table: [
      ['경험', 'S/T', 'Action', 'Result'],
      ...expItems.slice(0, 4).map((e, i) => [e.heading || `경험 ${i + 1}`, e.problem?.[0] || e.role || e.period || '문제/과제', e.action?.[0] || e.bullets?.[0] || '핵심 실행', e.result?.[0] || (e.metrics?.[0] ? `${e.metrics[0].label} ${metricText(e.metrics[0])}` : '성과 정리')]),
    ] },
    ...expItems.slice(0, 3).map((e, i) => makeExperienceSlide(`s${5 + i}`, `STAR ${i + 1}`, `${e.heading || `대표 경험 ${i + 1}`}의 STAR`, e, `${e.role || e.period || '역할'} · 행동과 결과 중심`)),
    { id: 's8', layout: 'proposal', sectionLabel: '성과 증거', proposalVariant: 'darkStats', dark: true, title: 'STAR가 성과로 이어진 근거입니다', subtitle: '결과 슬라이드는 수치, 변화, 검증 방식이 함께 보여야 설득력이 생깁니다', metrics: ctx.metricPool.slice(0, 4) },
    { id: 's9', layout: 'proposal', sectionLabel: '직무 매칭', proposalVariant: 'criteria', title: target ? `${target} 요구 역량과 연결했습니다` : '지원 직무 요구 역량과 연결했습니다', subtitle: '경험을 직무 언어로 다시 묶어 면접 질문에 대비합니다', items: [
      { heading: '문제 정의력', body: pickBullets()[0] || '상황을 구조화하고 우선순위를 판단' },
      { heading: '실행력', body: pickBullets()[1] || '맡은 역할 안에서 실행안을 설계' },
      { heading: '성과 회고', body: firstMetric.label ? `${firstMetric.label} 기반 개선` : '결과를 다음 액션으로 연결' },
      { heading: '협업 방식', body: pickBullets()[2] || '관계자와 기준을 맞추고 실행' },
    ] },
    buildClosingSlide(ctx, 's10'),
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
  return { meta, slides: expandAcceptedDeckToThirty(slides, ctx, mode) };
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

function buildAcceptedExpansionSlide(ctx, mode, number, source = {}) {
  const exp = ctx.expAt(number);
  const metric = ctx.metricPool[number % Math.max(1, ctx.metricPool.length)] || ctx.firstMetric;
  const modeLabel = {
    narrative: 'Story Evidence',
    star: 'STAR Evidence',
    'kpi-dashboard': 'KPI Evidence',
    timeline: 'Timeline Evidence',
    'case-study': 'Case Evidence',
  }[mode] || 'Portfolio Evidence';
  const sectionLabels = [
    'Opening Signal', 'Context', 'Problem', 'Decision', 'Execution', 'Evidence',
    'Impact', 'Learning', 'Fit', 'Collaboration', 'Risk', 'Next Move',
    'Metric Proof', 'User Insight', 'Role Scope', 'Before / After', 'Process Log',
    'Result Detail', 'Skill Match', 'Interview Hook', 'Growth Point', 'Case Note',
    'KPI Trace', 'Roadmap', 'Final Proof',
  ];
  const label = sectionLabels[(number - 1) % sectionLabels.length];
  const heading = exp.heading || source.title || 'Representative Experience';
  const bullets = ctx.pickBullets([
    exp.problem?.[0] || exp.body || 'Define the problem clearly',
    exp.action?.[0] || 'Explain the decision and execution path',
    exp.result?.[0] || 'Connect the result to role fit',
    ctx.strengths[number % Math.max(1, ctx.strengths.length)] || 'Show repeatable working style',
  ]);
  const variants = ['', 'proof', 'quote', 'map', 'signal', 'snapshot'];
  const titlePatterns = [
    `${label}: ${heading}`,
    `${heading}?? ??? ${label}`,
    `${modeLabel} ${String(number).padStart(2, '0')}`,
    `${ctx.target || '?? ??'} ??? ${label}`,
  ];
  return {
    id: 's' + number,
    layout: 'proposal',
    sectionLabel: label,
    proposalVariant: variants[number % variants.length],
    title: titlePatterns[number % titlePatterns.length],
    subtitle: `${modeLabel} ? ${ctx.userName}`,
    bullets: bullets.slice(0, 4),
    metrics: metric ? [metric] : [],
    items: [
      { heading: exp.heading || label, role: exp.role || ctx.target || modeLabel, period: exp.period || '', body: exp.body || bullets[0] || '', bullets: bullets.slice(0, 3), metrics: exp.metrics || [] },
      { heading: 'Problem', body: exp.problem?.[0] || bullets[0] || '??? ??? ??' },
      { heading: 'Action', body: exp.action?.[0] || bullets[1] || '??? ?? ??? ??' },
      { heading: 'Result', body: exp.result?.[0] || bullets[2] || '??? ?? ?? ??' },
    ],
  };
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
    const compact = (value, max = 95) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
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
      problem: keyExperiences.map(k => compact(k.situation, 76)).filter(Boolean).slice(0, 3),
      action: keyExperiences.map(k => compact(k.action, 76)).filter(Boolean).slice(0, 3),
      result: keyExperiences.map(k => compact(k.result, 76)).filter(Boolean).slice(0, 3),
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
  const userName = p.userName || '';
  const target = `${p.targetCompany || ''} ${p.targetPosition || ''}`.trim();

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
    const compact = (s, max = 80) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
    const problem = keyExps.map(k => compact(k.situation)).filter(Boolean).slice(0, 3);
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
