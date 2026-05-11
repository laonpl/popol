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
  const target = `${p.targetCompany || ''} ${p.targetPosition || ''}`.trim();
  const experiences = normalizeExperiences(p).slice(0, 6);
  const primary = experiences[0] || {};
  const allMetrics = experiences.flatMap(e => e.metrics || []).filter(m => m.label || m.value).slice(0, 6);
  const keywordSet = new Set();
  experiences.forEach(e => (e.keywords || []).slice(0, 4).forEach(k => keywordSet.add(String(k).trim())));
  const keywords = Array.from(keywordSet).filter(Boolean).slice(0, 8);
  const strengths = deriveStrengths(experiences, p);
  const contactBullets = [p.contact?.email && `Email · ${p.contact.email}`, p.contact?.phone && `Phone · ${p.contact.phone}`, p.contact?.website && `Web · ${p.contact.website}`].filter(Boolean);
  const expItems = experiences.length ? experiences : [{ heading: '대표 경험', role: target || '지원 직무', body: '경험 정리 내용이 입력되면 이 영역에 핵심 수행 내용과 성과가 자동으로 구성됩니다.', bullets: ['문제 정의', '해결 과정', '성과 정리'], metrics: [] }];
  const firstMetric = allMetrics[0] || { label: '대표 성과', value: 'Impact', before: '', after: '' };
  const metricText = (m) => m.before && m.after ? `${m.before} → ${m.after}` : (m.value || '성과');
  const pickBullets = (fallback = []) => {
    const fromExp = expItems.flatMap(e => e.bullets || []).filter(Boolean);
    return (fromExp.length ? fromExp : fallback).slice(0, 6);
  };

  slides.push({
    id: 's1',
    layout: 'cover',
    title: target ? `${target} 맞춤 포트폴리오` : `${userName} 포트폴리오`,
    subtitle: `${userName}의 경험 정리를 기준으로`,
    bullets: ['RELIABILITY', 'PARTNERSHIP', 'SCALABILITY'],
  });

  slides.push({
    id: 's2',
    layout: 'proposal',
    sectionLabel: '목차',
    proposalVariant: 'contents',
    title: '목차',
    items: [
      { heading: '제안 배경', role: 'Background', body: '지원 직무와 경험 연결 기준' },
      { heading: '자사 소개', role: 'Candidate Overview', body: `${userName}의 핵심 역량` },
      { heading: '서비스 방안', role: 'Portfolio Approach', body: '경험 기반 문제 해결 사례' },
      { heading: '계획 및 조건', role: 'Plan & Terms', body: '협업 방식과 성장 가능성' },
    ],
  });

  slides.push({
    id: 's3',
    layout: 'proposal',
    sectionLabel: '제안 배경',
    proposalVariant: 'threeCards',
    title: target ? `왜 지금, ${target}에 맞는 경험 증명이 필요한가요?` : '왜 지금, 경험 기반 포트폴리오가 필요한가요?',
    subtitle: '경험은 많아도 채용 담당자가 바로 이해할 수 있는 구조로 재정리되어야 합니다',
    items: [
      { heading: '채용 환경 변화', body: '단순 스펙보다 문제 해결 과정과 역할 기여도를 확인합니다' },
      { heading: `${userName}의 과제`, body: primary.heading ? `${primary.heading} 경험을 직무 언어로 재구성해야 합니다` : '흩어진 경험을 직무 기준으로 연결해야 합니다' },
      { heading: '포트폴리오 필요성', body: '성과와 학습을 한눈에 볼 수 있는 제안서형 구조가 필요합니다' },
    ],
  });

  slides.push({
    id: 's4',
    layout: 'proposal',
    sectionLabel: '제안 배경',
    proposalVariant: 'splitPhotoList',
    title: target ? `${target} 속 경험 증명이 요구됩니다` : '지원 직무 속 경험 증명이 요구됩니다',
    subtitle: '대표 수행 사례를 기반으로 직무 적합성과 실행 가능성을 설명합니다',
    items: expItems.slice(0, 3).map(e => ({ heading: e.heading, role: e.role || e.period, body: e.body || (e.bullets || [])[0] || '' })),
  });

  slides.push({
    id: 's5',
    layout: 'proposal',
    sectionLabel: '자사 소개',
    proposalVariant: 'timeline',
    title: `${userName}의 경험 흐름을 소개합니다`,
    subtitle: '주요 경험이 어떻게 이어지고 성장했는지 시간 순서로 보여줍니다',
    items: expItems.slice(0, 5).map(e => ({ heading: e.heading, period: e.period || e.role, body: e.body || (e.bullets || [])[0] || '' })),
  });

  slides.push({
    id: 's6',
    layout: 'proposal',
    sectionLabel: '자사 소개',
    proposalVariant: 'darkStats',
    dark: true,
    title: `${userName}의 검증된 실행력입니다`,
    subtitle: '경험정리에서 확인된 수행 기록과 성과를 핵심 지표로 제시합니다',
    metrics: [
      { label: '대표 사례', value: `${expItems.length}+` },
      { label: firstMetric.label || '대표 성과', value: metricText(firstMetric) },
      { label: '핵심 키워드', value: `${keywords.length || strengths.length}+` },
      { label: '직무 연결성', value: target ? '맞춤형' : '확장형' },
    ],
  });

  slides.push({
    id: 's7',
    layout: 'proposal',
    sectionLabel: '자사 소개',
    proposalVariant: 'bubbleCore',
    title: `${userName}를 완성하는 핵심입니다`,
    subtitle: '반복적으로 드러난 강점을 중심으로 후보자 경쟁력을 설명합니다',
    bullets: strengths.length ? strengths.slice(0, 4) : ['문제 구조화', '실행 중심 협업', '성과 기반 회고', '지속 학습'],
  });

  slides.push({
    id: 's8',
    layout: 'proposal',
    sectionLabel: '제안 배경',
    proposalVariant: 'comparison',
    title: '환경 변화에 따른 포트폴리오 구조의 필요성입니다',
    subtitle: '지원 직무의 요구와 보유 경험 사이의 연결을 명확히 만듭니다',
    items: [
      { heading: '외부환경 측면', body: target ? `${target}에 맞는 경험 해석과 증거가 필요합니다` : '채용 과정에서 직무 맥락과 증거가 중요해졌습니다' },
      { heading: '후보자 측면', body: `${userName}의 경험을 성과·역할·학습 기준으로 재배열해야 합니다` },
    ],
  });

  slides.push({ id: 's9', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'metricBars', title: '기업의 채용 과제를 해결하는 차별화된 가치입니다', subtitle: '경험과 직무 니즈가 결합될 때 달성 가능한 구체적 성과를 명시합니다', bullets: pickBullets(['직무 적합도 향상', '문제 해결력 증명', '성과 중심 커뮤니케이션', '협업 가능성 강화']) });

  slides.push({ id: 's10', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'graphCallout', title: target ? `${target} 변화에 선제적으로 대응합니다` : '채용 시장 변화에 선제적으로 대응합니다', subtitle: '경험정리가 보여주는 추세와 성장 가능성, 주요 변화 요인을 설명합니다', bullets: pickBullets(['경험 축적에 따른 문제 해결 범위 확장', '프로젝트별 역할과 책임 증가', '성과 중심 커뮤니케이션 강화']) });

  slides.push({ id: 's11', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'synergy', title: '파트너십으로 극대화되는 채용 시너지입니다', subtitle: '지원자의 경험과 기업 니즈가 결합되어 더 빠르고 안정적인 성과를 만듭니다', items: [
    { heading: userName, body: '경험·역량·성과 증거' },
    { heading: '채용 속도 향상', body: primary.heading || '대표 사례 기반 판단' },
    { heading: '채용 품질 강화', body: firstMetric.label || '성과 기반 검증' },
    { heading: target || '지원 기업', body: '직무 니즈와 조직 적합성' },
  ] });

  slides.push({ id: 's12', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'threeCards', title: '파트너십을 통해 창출되는 가치를 작성합니다', subtitle: '경험정리에서 확인된 전문성과 니즈가 결합되어 나타나는 효과입니다', items: expItems.slice(0, 3).map((e, i) => ({ heading: ['채용 속도 향상', '채용 품질 강화', '운영 효율 개선'][i] || e.heading, body: e.bullets?.[0] || e.body || e.heading })) });

  slides.push({ id: 's13', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'venn', title: '강점이 만나는 지점에서 해답을 제시합니다', subtitle: '후보자의 역량과 기업의 요구사항을 연결해 가장 설득력 있는 포인트를 도출합니다', items: [
    { heading: `${userName}의 대표 사례`, body: strengths[0] || primary.heading || '문제 해결 경험' },
    { heading: target || '기업 니즈', body: '직무 요구사항과 조직 적합성' },
    { heading: '해답', body: firstMetric.label ? `${firstMetric.label} 중심의 성과 증명` : '성과 중심 포트폴리오' },
  ] });

  slides.push({ id: 's14', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'splitPhotoList', title: '채용 프로세스 전반을 대행합니다', subtitle: '경험 정리부터 직무 맞춤 표현까지 단계적으로 지원합니다', items: [
    { heading: '경험 구조화', body: '분산된 경험을 문제·행동·성과로 재정리' },
    { heading: '직무 매칭', body: target ? `${target} 요구와 경험 연결` : '지원 직무 기준으로 재배치' },
    { heading: '성과 표현', body: firstMetric.label ? `${firstMetric.label} 지표 강조` : '정량·정성 성과 강조' },
  ] });

  slides.push({ id: 's15', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'stairSteps', title: '다섯 단계로 완성되는 채용 전략입니다', subtitle: '경험 정리를 채용 담당자가 이해하는 제안서 구조로 전환합니다', items: ['경험 수집', '역량 기준 선별', '문제 해결 사례화', '성과 지표 강조', '최종 제안서 구성'].map((heading, i) => ({ heading, body: pickBullets()[i] || '경험 기반 내용 구성' })) });

  slides.push({ id: 's16', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'roleTable', title: '역할 분담을 통해 채용의 완성도를 높입니다', subtitle: '후보자 경험과 기업 요구가 만나는 지점을 표 형태로 정리합니다', table: [
    ['기간', '단계', userName, target || '지원 기업'],
    ['Phase 1', '경험 준비', '경험 정리 및 핵심 성과 선별', '직무 요구사항 정의'],
    ['Phase 2', '전략 수립', '강점과 사례 연결', '평가 기준 확인'],
    ['Phase 3', '검증', '문제 해결 사례 구체화', '적합 후보자 판단'],
    ['Phase 4', '최종 정리', '포트폴리오 완성', '면접 및 협업 검토'],
  ] });

  slides.push({ id: 's17', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'targetCircle', title: '채용 대행 서비스 협력 체계입니다', subtitle: '경험과 직무 니즈를 한 문장으로 설명할 수 있게 구성합니다', items: [
    { heading: userName, body: '주요 경험과 성과' },
    { heading: '공동 목표', body: firstMetric.label || '직무 적합성 증명' },
    { heading: target || '지원 기업', body: '채용 니즈와 역할 범위' },
  ] });

  slides.push({ id: 's18', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'caseGrid', dark: true, title: '성공적으로 수행한 경험 사례입니다', subtitle: '전문적인 경험 구조화를 통해 적합성을 보여주는 주요 사례입니다', items: expItems.slice(0, 4).map(e => ({ heading: e.heading, role: e.role || e.period, body: e.bullets?.[0] || e.body || '' })) });

  slides.push({ id: 's19', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'testimonial', dark: true, title: '채용 성과로 이어진 실제 경험을 소개합니다', subtitle: '경험 과정 전반에 대한 성과와 협업 방식을 확인할 수 있습니다', bullets: pickBullets(['직무에 적합한 경험 추천', '신속한 문제 해결', '체계적인 커뮤니케이션']) });

  slides.push({ id: 's20', layout: 'proposal', sectionLabel: '계획 및 조건', proposalVariant: 'conditionGrid', title: '검증된 경험 서비스를 통한 기대 효과입니다', subtitle: '실제 경험 성과를 바탕으로 효율적인 채용 운영과 적합 인재 확보를 지원합니다', items: ['대표 사례 확보', '채용 기간 단축', '경험 효율성 향상', '안정적인 협업 운영'].map((heading, i) => ({ heading, body: pickBullets()[i] || '경험 기반 효과를 정리합니다' })) });

  slides.push({ id: 's21', layout: 'proposal', sectionLabel: '계획 및 조건', proposalVariant: 'criteria', title: '협업을 위한 서비스 운영 기준을 안내드립니다', subtitle: '필수 조건이 누락되지 않았는지 확인할 수 있도록 기준을 정리합니다', items: [
    { heading: '수행 기간 및 운영 기준', body: primary.period || '경험 수행 기간과 운영 범위를 명확히 제시' },
    { heading: '성과 기준 및 증거', body: firstMetric.label ? `${firstMetric.label} ${metricText(firstMetric)}` : '성과 지표와 결과를 명확히 제시' },
    { heading: '정보 보호 및 기록 유지', body: '경험 데이터와 개인정보를 안전하게 활용' },
    { heading: '협업 체계 및 책임 범위', body: '역할과 책임, 커뮤니케이션 기준을 명확히 설정' },
  ] });

  slides.push({ id: 's22', layout: 'proposal', sectionLabel: '계획 및 조건', proposalVariant: 'gantt', title: '단계별 추진 일정에 따라 체계적으로 진행합니다', subtitle: '경험 정리부터 제안서 완성까지 단계별 일정을 관리합니다', items: ['경험 수집 및 분석', '대표 사례 선별', '제안서 구성', '최종 검토 및 개선'].map((heading, i) => ({ heading, role: ['Week 1', 'Week 2-3', 'Week 3-5', 'Week 5-6'][i], body: pickBullets()[i] || '단계별 작업 수행' })) });

  slides.push({ id: 's23', layout: 'proposal', sectionLabel: '계획 및 조건', proposalVariant: 'stageCards', title: '전문적인 단계별 운영으로 채용 성과를 높입니다', subtitle: '각 단계마다 최적화된 지원을 제공하여 성공적인 채용으로 이어지도록 돕습니다', items: ['채용 기획', '후보자 발굴 추천', '면접 및 평가 지원', '합격 및 입사 지원', '입사 후 정착 지원'].map((heading, i) => ({ heading, body: pickBullets()[i] || '단계별 핵심 활동을 수행합니다' })) });

  slides.push({ id: 's24', layout: 'proposal', sectionLabel: '서비스 방안', proposalVariant: 'pyramid', title: '더 나은 채용을 위한 서비스 지향점을 제시합니다', subtitle: '명확한 기준과 방향성을 바탕으로 서비스를 제공합니다', items: [
    { heading: 'BASE', body: strengths[0] || '전문적인 수행 기반' },
    { heading: 'MATCH', body: strengths[1] || '정확한 인재 매칭 지향' },
    { heading: 'RESULT', body: firstMetric.label || '성과 창출 실현' },
  ] });

  slides.push({ id: 's25', layout: 'proposal', sectionLabel: '계획 및 조건', proposalVariant: 'faqCards', title: '검증된 경험 서비스를 통한 기대 효과입니다', subtitle: '자주 확인해야 할 협업 조건과 운영 기준을 명확히 정리합니다', items: [
    { heading: '서비스 기간에 관해', body: primary.period || '경험과 직무 범위에 따라 운영 기간을 조정합니다' },
    { heading: '초기 비용에 관해', body: '초기 투입 리소스와 준비 범위를 명확히 관리합니다' },
    { heading: '계약 후 시작에 관해', body: '합의된 일정에 따라 단계적으로 진행합니다' },
    { heading: '추가 문의에 관해', body: '변경사항과 추가 요청을 정기적으로 공유합니다' },
  ] });

  slides.push({ id: 's26', layout: 'proposal', sectionLabel: '계획 및 조건', proposalVariant: 'promise', title: '안정적인 채용 운영과 성공 수행을 약속드립니다', subtitle: '검증된 운영 체계와 전략적 접근을 기반으로 지속 가능한 성과를 실현합니다', bullets: ['전문 운영 체계 기반 효율화', '적합 인재 확보 및 경쟁력 강화', '운영 효율 향상 및 비용 절감'] });

  slides.push({ id: 's27', layout: 'proposal', sectionLabel: '계획 및 조건', proposalVariant: 'budget', dark: true, title: '합리적인 기준에 따른 예산 구성안입니다', subtitle: '효율적인 운영과 안정적인 수행을 위한 최적의 리소스 구조를 제시합니다', items: [
    { heading: '45%', body: '대표 사례 정리 및 제안서 구성' },
    { heading: '35%', body: '직무 분석 및 맞춤화' },
    { heading: '10%', body: '검토 및 개선' },
    { heading: '10%', body: '기타 운영' },
  ] });

  slides.push({ id: 's28', layout: 'proposal', sectionLabel: '계획 및 조건', proposalVariant: 'risk', title: '서비스 수행 리스크 및 대응 방안입니다', subtitle: '주요 리스크에 대한 사전 대응 체계를 기반으로 안정적인 운영을 지원합니다', items: [
    { heading: '일정 지연', body: '경험 자료 보완과 검토 일정 조율' },
    { heading: '정보 부족', body: '추가 질문과 구조화 인터뷰로 보완' },
    { heading: '채용 포기', body: '지원 방향 재설정 및 대안 포지션 탐색' },
  ] });

  slides.push({ id: 's29', layout: 'proposal', sectionLabel: '계획 및 조건', proposalVariant: 'orbit', title: '계약 기간과 서비스 조건을 안내드립니다', subtitle: '제공 범위와 책임 기준을 명확히 하여 안정적 협력이 이루어질 수 있도록 안내드립니다', items: [
    { heading: '계약 기간 및 적용 기준', body: primary.period || '프로젝트 범위에 따라 일정 조정' },
    { heading: '서비스 범위 및 제공 기준', body: '경험 정리와 포트폴리오 구성 지원' },
    { heading: '정보 보호 및 기록 유지 기준', body: '개인정보와 경험 데이터 보호' },
    { heading: '협업 체계 및 책임 범위 기준', body: '역할과 책임을 명확히 설정' },
  ] });

  const values = p.values || p.valuesEssay || p.about;
  slides.push({
    id: `s${slides.length + 1}`,
    layout: 'closing',
    proposalVariant: 'closing',
    dark: true,
    sectionLabel: '마무리',
    title: 'Ready to Get Started?',
    subtitle: `${userName}의 경험이 ${target || '다음 기회'}에 기여하겠습니다.`,
    bullets: contactBullets.length ? contactBullets : [values ? splitSentences(values, 1)[0] : '경험 정리 기반 포트폴리오'],
  });

  return { meta: { title: `${userName} 제안서형 포트폴리오`, subtitle: target, accentColor: '#FF4F1A', templateMode: 'proposal-v1' }, slides };
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
