const SECTION_KEYS = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];

const SECTION_LABELS = {
  intro: '프로젝트 소개',
  overview: '프로젝트 개요',
  task: '진행한 일',
  process: '과정',
  output: '결과물',
  growth: '성장한 점',
  competency: '역량',
};

function asText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    return Object.values(value).map(asText).filter(Boolean).join('\n');
  }
  return String(value).trim();
}

/**
 * 파일에서 추출한 원본 텍스트의 노이즈를 제거한다.
 * (스캔 PDF는 본문 없이 "1 of 22" 같은 페이지 마커만 추출되는 경우가 많아
 *  이를 그대로 결과 필드에 넣으면 화면이 깨져 보인다.)
 */
export function cleanRawText(value) {
  let text = asText(value);
  if (!text) return '';
  text = text
    // "--- 파일명.pdf ---", "=== AI 인터뷰 ===" 등 구분선/헤더 라인
    .replace(/^[ \t]*(?:-{3,}|={3,})[^\n]*(?:-{3,}|={3,})?[ \t]*$/gm, '')
    // "-- 1 of 22 --" / "1 of 22" / "Page 3 / 22" / "페이지 3" 페이지 마커
    .replace(/^[ \t]*-{0,}\s*\d{1,4}\s*(?:of|\/)\s*\d{1,4}\s*-{0,}[ \t]*$/gim, '')
    .replace(/\b\d{1,4}\s+of\s+\d{1,4}\b/gi, '')
    .replace(/^[ \t]*(?:page|페이지)\s*\d+(?:\s*[/|of]+\s*\d+)?[ \t]*$/gim, '')
    // 숫자만 있는 라인 (페이지 번호 잔여물)
    .replace(/^[ \t]*\d{1,4}[ \t]*$/gm, '')
    // 남은 구분 기호만 있는 라인
    .replace(/^[ \t]*[-=·•]{1,}[ \t]*$/gm, '');
  // 줄 단위 공백 정리 + 과도한 빈 줄 축소
  text = text
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

function firstFilled(...values) {
  return values.map(asText).find(Boolean) || '';
}

function unique(values, limit = 10) {
  return [...new Set(values.map(v => asText(v)).filter(Boolean))].slice(0, limit);
}

function parseCarl(text = '') {
  const source = asText(text);
  if (!source) return {};
  const read = (label, nextLabels) => {
    const next = nextLabels.join('|');
    const match = source.match(new RegExp(`${label}\\s*[:：]\\s*([\\s\\S]*?)(?=\\n\\s*(?:${next})\\s*[:：]|$)`, 'i'));
    return match?.[1]?.trim() || '';
  };
  return {
    context: read('Context', ['Action', 'Result', 'Learning']),
    action: read('Action', ['Result', 'Learning']),
    result: read('Result', ['Learning']),
    learning: read('Learning', []),
  };
}

function extractMetrics(text = '', limit = 4) {
  const source = asText(text);
  const patterns = [
    /\d[\d,.]*\s*(?:%|배|ms|초|분|시간|일|주|개월|년|개|건|명|원|만원|억|회|점|위|줄|라인)/g,
    /\d[\d,.]*\s*(?:->|→|에서)\s*\d[\d,.]*\s*(?:%|배|ms|초|분|시간|일|주|개월|년|개|건|명|원|만원|억|회|점|위|줄|라인)?/g,
  ];
  return unique(patterns.flatMap(pattern => source.match(pattern) || []), limit);
}

function classifyInterviewAnswer(question = '') {
  const q = asText(question).toLowerCase();
  if (/(결과|성과|수치|변화|이후|after|효과|임팩트|얼마나|몇|줄었|늘었|개선되|개선했|개선됨|감소|증가|단축|향상|완료율|전환율)/i.test(q)) return 'result';
  if (/(배운|느낀|성장|아쉬|다음|인사이트|교훈|learning|중요|깨달)/i.test(q)) return 'learning';
  if (/(어떻게|실행|행동|해결|과정|의사결정|선택|맡|역할|기여|action|process|설계|구현|도입|분석|제작|전환)/i.test(q)) return 'action';
  if (/(배경|문제|상황|계기|목표|이전|전후|before|왜|context|problem|기존|어려|불편|막히|이탈|낮았)/i.test(q)) return 'context';
  return 'context';
}

function joinLimited(values, limit = 1200) {
  return cleanRawText(values.map(asText).filter(Boolean).join('\n\n')).slice(0, limit);
}

export function buildInterviewMoment({ title = '', sourceText = '', qa = [] } = {}) {
  const buckets = { context: [], action: [], result: [], learning: [] };
  const allAnswers = [];

  (qa || []).forEach(item => {
    const answer = cleanRawText(item?.a || item?.answer || '');
    if (!answer) return;
    allAnswers.push(answer);
    buckets[classifyInterviewAnswer(`${item?.q || item?.question || ''}\n${answer}`)].push(answer);
  });

  const cleanedSource = cleanRawText(sourceText);
  if (cleanedSource.length >= 40) buckets.context.unshift(cleanedSource.slice(0, 1200));

  const combined = joinLimited(allAnswers, 1800);
  const metrics = extractMetrics(`${cleanedSource}\n${combined}`, 4);
  const keywords = unique([
    ...extractMetrics(`${cleanedSource}\n${combined}`, 3),
    ...asText(title).split(/\s+/),
    ...(combined.match(/[\p{L}\p{N}_+#.-]{2,}/gu)?.slice(0, 12) || []),
  ], 8);

  return {
    id: `interview-${Date.now()}`,
    title: title || 'AI 인터뷰 기반 핵심 경험',
    description: joinLimited([
      buckets.context.length ? `[문제/전후상황]\n${joinLimited(buckets.context, 900)}` : '',
      buckets.action.length ? `[실행]\n${joinLimited(buckets.action, 900)}` : '',
      buckets.result.length ? `[결과]\n${joinLimited(buckets.result, 700)}` : '',
      buckets.learning.length ? `[배운 점]\n${joinLimited(buckets.learning, 600)}` : '',
      !buckets.context.length && !buckets.action.length && !buckets.result.length ? combined : '',
    ], 3000),
    context: joinLimited(buckets.context.length ? buckets.context : allAnswers.slice(0, 2), 1000),
    action: joinLimited(buckets.action.length ? buckets.action : allAnswers.slice(1, 4), 1000),
    result: joinLimited(buckets.result.length ? buckets.result : allAnswers.filter(answer => extractMetrics(answer, 1).length), 800),
    learning: joinLimited(buckets.learning, 700),
    metric: metrics[0] || '',
    metricLabel: metrics[0] ? '핵심 수치' : '',
    beforeMetric: metrics.find(metric => /(?:->|→|에서)/.test(metric)) || '',
    afterMetric: metrics[0] || '',
    keywords,
    chartType: 'horizontalBar',
  };
}

function normalizeMoment(moment = {}, index = 0) {
  const parsed = parseCarl(moment.description);
  const context = cleanRawText(firstFilled(moment.context, moment.situation, parsed.context));
  const action = cleanRawText(firstFilled(moment.action, parsed.action));
  const result = cleanRawText(firstFilled(moment.result, parsed.result));
  const learning = cleanRawText(firstFilled(moment.learning, parsed.learning));
  const description = cleanRawText(firstFilled(moment.description, [context, action, result, learning].join('\n')));

  return {
    title: firstFilled(moment.title, `핵심 경험 ${index + 1}`),
    metric: firstFilled(moment.metric, moment.afterMetric),
    metricLabel: firstFilled(moment.metricLabel, moment.metric ? '성과' : ''),
    beforeMetric: firstFilled(moment.beforeMetric),
    afterMetric: firstFilled(moment.afterMetric),
    context: context || description,
    action,
    result,
    learning,
    keywords: unique(moment.keywords || [], 6),
    chartType: moment.chartType || 'horizontalBar',
  };
}

function buildDraftHighlights(sections, keyExperiences) {
  const highlights = [];
  const push = (field, type, text, keywords = []) => {
    const cleanText = cleanRawText(text).slice(0, 260);
    if (!field || !cleanText) return;
    highlights.push({ field, type, text: cleanText, keywords: unique(keywords, 4) });
  };

  keyExperiences.forEach(item => {
    push('task', 'core', item.context, item.keywords);
    push('process', 'derived', item.action, item.keywords);
    push('output', 'core', firstFilled(item.result, item.metric, item.afterMetric), item.keywords);
    push('growth', 'growth', item.learning, item.keywords);
  });

  if (highlights.length === 0) {
    push('intro', 'core', sections.intro, []);
    push('competency', 'growth', sections.competency, []);
  }

  return highlights.slice(0, 8);
}

function buildDraftMarketResearch(sections, keyExperiences, keywords) {
  const first = keyExperiences[0] || {};
  const primaryMetric = first.metric || first.afterMetric || extractMetrics(Object.values(sections).join('\n'), 1)[0] || '';
  return {
    marketOverview: sections.overview
      ? '인터뷰 답변 기준으로 프로젝트 맥락을 정리했습니다. 외부 시장 수치는 AI 보강 단계에서 검증해 추가하세요.'
      : '',
    deskResearchInfographic: { title: '', subtitle: '', cards: [], conclusion: '', limitations: '빠른 초안에서는 실제 URL 검증이 필요한 인포그래픽 카드를 비워둡니다.' },
    decisionMetrics: [
      {
        metric: primaryMetric ? '핵심 성과 지표 검증' : '문제 전후 변화 지표',
        whyItMatters: '인터뷰 답변의 성과가 실제 전후 변화인지 판단하는 기준입니다.',
        recommendedProxy: primaryMetric ? `"${primaryMetric}"의 산출 기준, 비교 대상, 측정 기간을 확인` : 'Before/After 값, 처리 시간, 전환율, 완료율, 비용 절감액 중 확인 가능한 지표',
        researchBasis: '사용자 인터뷰 답변 기반. 외부 벤치마크는 AI 보강 단계에서 검증 필요.',
        confidence: primaryMetric ? 'medium' : 'low',
      },
      {
        metric: '본인 기여 범위',
        whyItMatters: '팀 성과와 본인 역할을 분리해야 포트폴리오 신뢰도가 올라갑니다.',
        recommendedProxy: '담당 업무, 의사결정 권한, 기여도, 협업자 수를 함께 기록',
        researchBasis: '채용 포트폴리오 검토 기준 기반.',
        confidence: 'medium',
      },
    ],
    sourceNotes: [],
    portfolioAngles: unique([
      first.context && '문제 전후 맥락을 먼저 보여주는 스토리',
      first.action && '내가 선택한 방법과 trade-off',
      primaryMetric && '수치의 산출 근거와 2차 효과',
      ...keywords.slice(0, 3),
    ], 5),
    limitations: '빠른 초안은 검색 검증을 수행하지 않았습니다. 실제 시장 수치와 출처는 AI 보강에서 확인하세요.',
  };
}

function joinSentences(values, fallback) {
  const text = values.map(asText).filter(Boolean).join('\n\n');
  return text || fallback;
}

function makeSectionSlides(sections, keyExperiences) {
  return Object.fromEntries(SECTION_KEYS.map(key => {
    const cards = keyExperiences.slice(0, 3).map((item, index) => ({
      label: index === 0 ? '핵심 근거' : `근거 ${index + 1}`,
      title: item.title,
      body: firstFilled(item.result, item.action, item.context),
      metric: firstFilled(item.afterMetric, item.metric),
    }));
    return [key, {
      kicker: SECTION_LABELS[key],
      headline: sections[key] ? sections[key].split('\n')[0].slice(0, 70) : SECTION_LABELS[key],
      subcopy: sections[key] || '',
      evidenceCards: cards,
    }];
  }));
}

export function buildDraftStructuredResult({
  title = '',
  period = '',
  jobCategory = 'common',
  moments = [],
  collectedText = '',
  content = {},
} = {}) {
  const keyExperiences = (moments || []).map(normalizeMoment).filter(item =>
    item.title || item.context || item.action || item.result
  );
  const fallbackText = cleanRawText(firstFilled(collectedText, content.rawInput, Object.values(content).join('\n')));
  const summarySource = keyExperiences[0] || {};
  const keywords = unique([
    ...keyExperiences.flatMap(item => item.keywords || []),
    ...(title ? [title] : []),
  ], 8);

  const sections = {
    intro: joinSentences([
      title && `${title} 경험을 빠르게 구조화한 초안입니다.`,
      summarySource.context,
    ], fallbackText.slice(0, 500) || '검토한 핵심 경험을 바탕으로 초안을 만들었습니다.'),
    overview: joinSentences(keyExperiences.map(item => item.context), '경험의 배경과 목표를 보강해 주세요.'),
    task: joinSentences(keyExperiences.map(item => item.action), '직접 맡은 역할과 실행 내용을 보강해 주세요.'),
    process: joinSentences(keyExperiences.map(item => item.action), '의사결정 과정, 시도한 대안, 문제 해결 흐름을 보강해 주세요.'),
    output: joinSentences(keyExperiences.map(item => firstFilled(item.result, item.metric, item.afterMetric)), '결과물과 성과 지표를 보강해 주세요.'),
    growth: joinSentences(keyExperiences.map(item => item.learning), '배운 점과 다음에 적용할 인사이트를 보강해 주세요.'),
    competency: joinSentences([
      keywords.length > 0 && `드러난 역량: ${keywords.join(', ')}`,
      keyExperiences.map(item => item.title).join(', '),
    ], '이 경험에서 드러난 역량과 입사 후 기여 방식을 보강해 주세요.'),
  };

  const projectOverview = {
    summary: firstFilled(summarySource.context, fallbackText.slice(0, 300), `${title} 경험 초안`),
    background: firstFilled(summarySource.context),
    goal: '',
    role: '',
    team: '',
    duration: period,
    scopeOfImpact: '',
    techStack: keywords.slice(0, 5),
  };

  return {
    _draft: true,
    _draftVersion: 2,
    projectOverview,
    marketResearch: buildDraftMarketResearch(sections, keyExperiences, keywords),
    keyExperiences,
    ...sections,
    sectionSlides: makeSectionSlides(sections, keyExperiences),
    jobCategory,
    jobSpecific: {},
    keywords,
    highlights: buildDraftHighlights(sections, keyExperiences),
    followUpQuestions: [
      '이 경험에서 가장 명확한 정량 성과는 무엇인가요?',
      '본인이 직접 맡은 범위와 팀 전체 성과를 어떻게 나눌 수 있나요?',
      '다른 선택지 대신 이 방법을 선택한 이유는 무엇인가요?',
    ],
  };
}
