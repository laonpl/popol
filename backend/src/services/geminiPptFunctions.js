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
  const userName = p.userName || p.name || p.nameKo || '지원자';
  const target = `${p.targetCompany || ''} ${p.targetPosition || ''}`.trim() || p.headline || p.title || '';
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

function refText(value, fallback = '', max = 120) {
  const text = String(value || fallback || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) : text;
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
  return ctx.contactBullets.length ? ctx.contactBullets : referenceContactBullets(ctx);
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

function referenceContactBullets(ctx) {
  return ctx.contactBullets.length ? ctx.contactBullets : [
    'Email - yushin@example.com',
    'GitHub - github.com/yushin-dev',
    'Portfolio - fitpoly.kr',
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
  const pName = (exp, fb) => (exp.heading && !/^경험|^대표/.test(exp.heading)) ? exp.heading : fb;
  const pBody = (exp, fb) => exp.body || exp.bullets?.[0] || fb;
  const slides = [
    {
      layout: 'narrative-cover',
      sectionLabel: `${userName} PORTFOLIO`,
      title: ctx.portfolio?.headline || `사용자 문제를\n코드로 해결하는\n${target}`,
      subtitle: `AI × Full-Stack × UX`,
      bullets: skillGroups.slice(0, 5).map(g => g.heading).filter(Boolean),
    },
    {
      layout: 'narrative-profile',
      sectionLabel: 'Profile',
      title: ctx.portfolio?.headline || `경험과 기술, 두 가지를 모두 설계하는 개발자`,
      items: [
        education[0] || refItem(userName, target, 'Education'),
        ...(education.slice(1, 2)),
      ],
      metrics: (awards.length ? awards.slice(0, 3) : [
        refItem('GCSC 대상', '구글 학생 개발자 커뮤니티 최고상', 'Award'),
        refItem('창업경진대회 최우수상', '실제 서비스 기획 및 개발 역량 인정', 'Award'),
      ]).slice(0, 3).map(a => refMetric(a.heading, a.period || 'Award', a.body)),
      subtitle: ctx.portfolio?.valuesEssay ? `"${refText(ctx.portfolio.valuesEssay, '', 80)}"` : '',
    },
    {
      layout: 'narrative-philosophy',
      sectionLabel: 'Philosophy',
      title: '경험 · 추억 · 가치 — 내가 개발하는 이유',
      items: (values.length ? values : [
        refItem('Experience', '직접 부딪히며 배운 것만이 진짜 역량이 된다'),
        refItem('Memory', '함께 만든 결과물은 성장의 증거로 남는다'),
        refItem('Value', '기술은 사람의 문제를 해결할 때 의미를 가진다'),
      ]).slice(0, 3),
      subtitle: ctx.portfolio?.about || '취업 준비생으로서 직접 겪은 비효율이 프로젝트의 출발점이 되었다. 내가 불편했던 것을 내가 해결한다.',
    },
    {
      layout: 'narrative-skills',
      sectionLabel: 'Technical Skills',
      title: '풀스택을 아우르는 기술 역량 맵',
      items: skillGroups.slice(0, 6),
      subtitle: `${target} · 프론트부터 배포까지 혼자서 전 과정을 책임질 수 있는 풀스택 개발자`,
    },
    {
      layout: 'narrative-problem',
      sectionLabel: '문제의 시작',
      title: `"${pBody(projectA, '취업 준비, 왜 이렇게 비효율적인가?')}"`,
      items: [
        refItem('Problem 01', projectA.problem?.[0] || '취업 준비생은 동일한 경험을 지원 직무마다 다르게 정리해야 한다'),
        refItem('Problem 02', projectA.problem?.[1] || '포트폴리오, 자기소개서, 이력서를 각각 따로 작성하는 반복 작업'),
        refItem('Problem 03', projectA.problem?.[2] || '단순 텍스트 편집기로는 핵심 역량 추출이 어렵다'),
      ],
      subtitle: '이 문제를 직접 겪은 개발자가 직접 해결책을 만들기로 결심했다.',
    },
    {
      layout: 'narrative-project',
      sectionLabel: 'Project 01',
      title: pName(projectA, 'POPOL'),
      subtitle: pBody(projectA, 'AI 기반 포트폴리오 자동 생성 플랫폼'),
      items: [
        refItem('Overview', projectA.body || 'AI 기반 포트폴리오 자동 생성 플랫폼'),
        refItem('기간', projectA.period || '2026년 4월'),
        refItem('역할', projectA.role || '풀스택 개발 (프론트엔드 + 백엔드 전담)'),
      ],
      bullets: (skillGroups[0]?.bullets || ['React', 'Node.js', 'Zustand', 'Firebase', 'JWT', 'Axios', 'Express', 'TailwindCSS']).slice(0, 9),
    },
    {
      layout: 'narrative-challenge',
      sectionLabel: 'Project 01',
      title: `${pName(projectA, 'POPOL')} · 문제의 시작`,
      items: [
        refItem('Problem 01', projectA.problem?.[0] || '사용자들은 자신의 다양한 경험을 일관성 있게 정리하는 데 많은 시간을 소모'),
        refItem('Problem 02', projectA.problem?.[1] || '각 지원 직무에 맞게 포트폴리오를 변형하는 반복 작업이 큰 부담'),
        refItem('Problem 03', projectA.problem?.[2] || '단순 편집기를 넘어 AI가 핵심 역량을 추출해주는 도구가 필요했다'),
        refItem('Action 01', projectA.action?.[0] || '경험 CRUD UI 구축 → AI 분석 파이프라인 설계'),
        refItem('Action 02', projectA.action?.[1] || 'Google OAuth + JWT 보안 인증 체계 구현'),
        refItem('Action 03', projectA.action?.[2] || '멀티 포맷 문서 Export 기능 개발'),
      ],
    },
    {
      layout: 'narrative-architecture',
      sectionLabel: 'Project 01',
      title: `${pName(projectA, 'POPOL')} · 전환점`,
      items: [
        refItem('프론트엔드', projectA.action?.[0] || 'Vite 기반 React 환경 선택 → 빠른 개발 속도 확보'),
        refItem('상태 관리', projectA.action?.[1] || 'Redux 대신 Zustand 채택 → 보일러플레이트 없이 직관적 상태 공유'),
        refItem('인증 설계', projectA.action?.[2] || 'Firebase Admin SDK로 Google OAuth 토큰 검증 → 서버 JWT 발행'),
        refItem('백엔드', projectA.action?.[3] || 'Node.js + Express 사용 → 가볍고 확장성 있는 API 서버 구축'),
      ],
      subtitle: projectA.result?.[0] || '상태 비저장(Stateless) 인증 방식으로 서버 부하를 줄이고 확장성을 확보했다',
    },
    {
      layout: 'narrative-results',
      sectionLabel: 'Project 01',
      title: `${pName(projectA, 'POPOL')} · 성과`,
      items: [
        refItem('Google OAuth 기반 회원가입/로그인 기능', projectA.result?.[0] || '완료'),
        refItem('경험 CRUD 및 AI 분석 요청 기능', projectA.result?.[1] || '완료'),
        refItem('포트폴리오 및 자기소개서 생성/관리 기능', projectA.result?.[2] || '완료'),
        refItem('멀티 포맷 Export 기능 (PDF, Word 등)', ''),
        refItem('React + Node.js 풀스택 설계 역량 전체 향상', ''),
        refItem('JWT 기반 인증 흐름 직접 설계 → 보안 이해 심화', ''),
        refItem('AI 비즈니스 요구사항을 실제 API 연동으로 구체화', ''),
      ],
    },
    {
      layout: 'narrative-project',
      sectionLabel: 'Project 02',
      title: pName(projectB, 'WINNOW'),
      subtitle: pBody(projectB, 'Google Gemini AI 기반 채용 공고 자동 생성 플랫폼'),
      items: [
        refItem('Overview', projectB.body || 'Google Gemini AI를 연동하여 채용 공고(JD)를 자동으로 생성하고 관리하는 플랫폼'),
        refItem('기간', projectB.period || '2026년 5월'),
        refItem('역할', projectB.role || '개발자 (프론트엔드 개발, Firebase/Google AI 연동, Vercel 배포 전담)'),
      ],
      bullets: ['Vite', 'Firebase Authentication', 'Firestore', 'Google AI (Gemini API)', 'Vercel'],
    },
    {
      layout: 'narrative-challenge',
      sectionLabel: 'Project 02',
      title: `${pName(projectB, 'WINNOW')} · 문제의 시작`,
      items: [
        refItem('Problem 01', projectB.problem?.[0] || '채용 공고 작성은 반복적이고 시간이 많이 소요되는 업무'),
        refItem('Problem 02', projectB.problem?.[1] || '핵심 키워드만으로 완성도 높은 공고 초안을 생성하는 도구가 없었다'),
        refItem('Problem 03', projectB.problem?.[2] || '사용자별 생성된 공고를 저장하고 관리할 수 있는 시스템 필요'),
        refItem('Action 01', projectB.action?.[0] || 'Google Gemini AI API 연동 → 텍스트 생성 기능 구현'),
        refItem('Action 02', projectB.action?.[1] || 'Firebase Auth + Firestore 사용자별 데이터 관리'),
        refItem('Action 03', projectB.action?.[2] || 'Vercel CI/CD 파이프라인 설정 및 배포 자동화'),
      ],
    },
    {
      layout: 'narrative-architecture',
      sectionLabel: 'Project 02',
      title: `${pName(projectB, 'WINNOW')} · 전환점`,
      items: [
        refItem('개발 전략', projectB.action?.[0] || '빠른 프로토타이핑과 개발 생산성 최우선 → Vite 선택'),
        refItem('AI 연동', projectB.action?.[1] || 'Google Gemini API로 텍스트 생성 기능 구현 → 실전 외부 API 연동 경험'),
        refItem('인프라', projectB.action?.[2] || 'Firebase(BaaS) 활용 → 서버리스 아키텍처로 인프라 관리 부담 최소화'),
        refItem('배포', projectB.action?.[3] || 'Vercel CI/CD 파이프라인 → 코드 푸시만으로 자동 배포 완성'),
      ],
      subtitle: projectB.result?.[0] || 'Firebase 같은 BaaS를 활용하면 최소한의 리소스로 MVP를 신속하게 구축하고 시장 반응을 검증할 수 있다',
    },
    {
      layout: 'narrative-results',
      sectionLabel: 'Project 02',
      title: `${pName(projectB, 'WINNOW')} · 성과`,
      items: [
        refItem('UX 개선 및 버그 수정 22% 달성', projectB.result?.[0] || ''),
        refItem('채용 대시보드 기능 개선', projectB.result?.[1] || ''),
        refItem('프롬프트 엔지니어링으로 AI 분석 정확도 개선', ''),
        refItem('빌드 실패 긴급 대응 경험', ''),
        refItem('외부 AI API(Google Gemini) 실전 연동 경험 획득', ''),
        refItem('Firebase와 같은 서버리스 아키텍처로 전체 개발 주기 단축', ''),
        refItem('Vite 환경 구성부터 Vercel 배포 자동화까지 풀스택 시야 확장', ''),
      ],
    },
    {
      layout: 'narrative-project',
      sectionLabel: 'Project 03',
      title: pName(projectC, 'React-Vite Boilerplate'),
      subtitle: pBody(projectC, '개발자를 위한 표준 개발 환경 템플릿'),
      items: [
        refItem('Overview', projectC.body || 'React와 Vite를 사용하는 개발자들을 위해 즉시 사용 가능한 최소 기능의 개발 환경 템플릿 제공'),
        refItem('기간', projectC.period || '2026년 5월'),
        refItem('역할', projectC.role || '개발 환경 설계 및 보일러플레이트 구축'),
      ],
      bullets: ['React', 'Vite', 'ESLint', 'Babel', 'SWC', 'TypeScript'],
    },
    {
      layout: 'narrative-challenge',
      sectionLabel: 'Project 03',
      title: `${pName(projectC, 'Boilerplate')} · 반복되는 초기 설정 비효율을 표준화로 해결하다`,
      items: [
        refItem('Problem 01', projectC.problem?.[0] || '개발자들은 새 프로젝트마다 Vite, React, ESLint 등을 연동하는 반복 작업을 수행'),
        refItem('Problem 02', projectC.problem?.[1] || '초기 설정에 소요되는 시간이 실제 개발 생산성을 저하시킴'),
        refItem('Solution 01', projectC.action?.[0] || 'React와 Vite 최신 버전 기반으로 최적의 조합 연구'),
        refItem('Solution 02', projectC.action?.[1] || '빠른 리프레시를 위해 Babel 기반과 SWC 기반 두 가지 옵션 제공'),
        refItem('Solution 03', projectC.action?.[2] || 'TypeScript + typescript-eslint 통합으로 프로덕션 앱 안정성 확보'),
      ],
      subtitle: projectC.result?.[0] || '개발 환경 최적화와 표준화 경험 → 기술적 제약과 요구사항을 이해하고 최적 솔루션을 기획하는 역량 강화',
    },
    {
      layout: 'narrative-awards',
      sectionLabel: 'Awards & Recognition',
      title: '교실 밖에서도 증명한 실력 — 수상과 어학 성취',
      items: (awards.length ? awards : [
        refItem('GCSC 대상', '구글 학생 개발자 커뮤니티 최고상'),
        refItem('창업경진대회 최우수상', '실제 서비스 기획 및 개발 역량 인정'),
        refItem('TOEIC 900점', '(2023.03 취득)\n글로벌 기술 문서 독해 및 협업 역량 보유', 'Language'),
      ]).slice(0, 5),
    },
    {
      layout: 'narrative-timeline',
      sectionLabel: 'Growth Curve',
      title: '문제를 발견하고 → 직접 해결하며 → 더 큰 문제에 도전하는 성장 곡선',
      items: ctx.expItems.slice(0, 5).map(exp => refItem(exp.heading, exp.body || exp.bullets?.[0] || exp.role, exp.period || exp.role)),
      subtitle: '매 프로젝트마다 더 복잡한 문제를 더 효율적인 방법으로 해결해왔다',
    },
    {
      layout: 'narrative-summary',
      sectionLabel: 'Core Competencies',
      title: `세 가지 핵심 역량으로 정의되는 개발자, ${userName}`,
      items: [
        refItem('풀스택 설계력', '프론트엔드(React/Vite/TypeScript)부터 백엔드(Node.js/Express), 배포(Vercel)까지 전 과정을 혼자 설계하고 구현할 수 있다.', 'POPOL'),
        refItem('AI API 연동 실전 경험', 'Google Gemini AI, Firebase AI 서비스를 실제 서비스에 연동하여 비즈니스 요구사항을 기술로 구현한 경험 보유.', 'WINNOW'),
        refItem('개발 환경 최적화 역량', 'Vite + TypeScript + ESLint + SWC 조합으로 개발 생산성을 극대화하는 표준 환경을 설계하고 공유할 수 있다.', 'BOILERPLATE'),
      ],
    },
    {
      layout: 'narrative-connection',
      sectionLabel: 'Project Connection',
      title: '세 프로젝트가 연결되어 만들어진 하나의 역량 체계',
      items: [
        refItem('POPOL', 'React\nNode.js\nJWT', '풀스택 아키텍처 설계', 'AI API 연동의 기초'),
        refItem('WINNOW', 'Gemini AI\nFirebase\nVercel', '외부 AI 연동 · BaaS + CI/CD', '개발 환경 최적화의 필요성 인식'),
        refItem('Boilerplate', 'Vite\nTypeScript\nESLint', '표준화와 생산성', '팀 협업 및 오픈소스 기여 역량'),
      ],
      subtitle: '각 프로젝트는 독립적이지 않다. 이전 경험이 다음 문제를 더 잘 해결하게 만들었다.',
    },
    {
      layout: 'narrative-roadmap',
      sectionLabel: 'Vision',
      title: '다음 기여 — 더 큰 문제를 더 좋은 팀과 함께 해결하고 싶다',
      items: (goals.length ? goals : [
        refItem('Short-Term Growth', `귀사의 서비스에서 사용자 문제를 발굴하고, React + AI 기반 솔루션으로 빠르게 기여`, 'SHORT-TERM'),
        refItem('Mid-Term Expansion', `팀의 개발 생산성을 높이는 표준화된 아키텍처와 개발 환경 구축에 기여`, 'MID-TERM'),
        refItem('Long-Term Vision', `사용자 경험 데이터를 AI로 분석하고 서비스를 개선하는 풀사이클 개발자로 성장`, 'LONG-TERM'),
      ]).slice(0, 3),
      subtitle: '"저는 문제를 발견하면 직접 해결하는 개발자입니다.\n귀사의 문제를 저의 다음 프로젝트로 삼고 싶습니다."',
    },
    {
      layout: 'narrative-closing',
      sectionLabel: 'Thank You',
      title: '"경험에서 배우고, 기술로 해결하며,\n함께 성장하는 개발자가 되겠습니다."',
      subtitle: `${userName} — ${ctx.portfolio?.headline || `사용자 문제를 코드로 해결하는 ${target}`}`,
      bullets: portfolioContactBullets(ctx),
      items: skillGroups.slice(0, 6).map(g => refItem(`#${g.heading.replace(/\s+/g, '')}`, g.heading)),
    },
  ];
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
