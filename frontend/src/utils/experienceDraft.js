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
    _draftVersion: 1,
    projectOverview,
    marketResearch: {
      marketOverview: '',
      decisionMetrics: [],
      sourceNotes: [],
      portfolioAngles: [],
      limitations: '빠른 초안 모드로 생성되어 시장/직무 근거는 AI 보강 후 채워집니다.',
    },
    keyExperiences,
    ...sections,
    sectionSlides: makeSectionSlides(sections, keyExperiences),
    jobCategory,
    jobSpecific: {},
    keywords,
    highlights: keyExperiences.slice(0, 5).map(item =>
      firstFilled(item.result, item.metric, item.action, item.title)
    ).filter(Boolean),
    followUpQuestions: [
      '이 경험에서 가장 명확한 정량 성과는 무엇인가요?',
      '본인이 직접 맡은 범위와 팀 전체 성과를 어떻게 나눌 수 있나요?',
      '다른 선택지 대신 이 방법을 선택한 이유는 무엇인가요?',
    ],
  };
}
