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

function isProposalTemplateHint(templateHint) {
  const hint = String(templateHint || '').toLowerCase().trim();
  if (!hint) return false;
  if (hint.includes('standard') || hint.includes('proposal') || hint.includes('1번') || hint.includes('template-1')) return true;
  const proposalPaletteIds = [
    'lean-dev', 'notion-pm', 'double-diamond', 'bento-metric', 'startup-hustler',
    'research-archival', 'cyberpunk', 'ats-classic', 'component-creator', 'sustainable',
  ];
  return proposalPaletteIds.some(id => hint === id || hint.endsWith(`:${id}`) || hint.includes(`theme-${id}`));
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

  return {
    meta: {
      title: target ? `${userName} · ${target} 포트폴리오` : `${userName} 포트폴리오`,
      subtitle: target,
      accentColor: '#FF4F1A',
      templateMode: 'proposal-v2',
    },
    slides,
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
