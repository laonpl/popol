const clean = (value) => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\[[^\]]+\]\([^\)]+\)/g, ' ')
  .replace(/[#*_>`~|]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const textOf = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return clean(value);
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(' ');
  if (typeof value === 'object') return Object.values(value).map(textOf).filter(Boolean).join(' ');
  return '';
};

const meaningful = (value, min = 6) => {
  const text = clean(value);
  if (text.length < min) return false;
  if (/^\[?(?:확인|입력|작성|정보)\s*(?:필요|없음)?\]?$/i.test(text)) return false;
  if (/^(?:경험의|프로젝트의|본인의|직접 맡은|결과물과|배운 점과).*(?:보강|입력|작성|확인).*(?:주세요|필요)/i.test(text)) return false;
  return true;
};

/* 시점 표기(2024년 3월, 2024.03)는 성과가 아니므로 지표 판정에서 먼저 걷어낸다. */
const DATE_LIKE = /\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]?\s*\d{0,2}\s*일?|\d{4}\s*년/g;
const METRIC_UNIT = /\d[\d,.]*\s*(?:%|퍼센트|배|건|명|개|초|분|시간|일|주|개월|원|점|위|회|등|만|억|ms|k)/i;
const METRIC_RATIO = /\d[\d,.]*\s*\/\s*\d/;   // 4.6/5 같은 평점

/** 문장에 검증 가능한 수치가 들어 있는지. 모든 직무 가이드가 1순위로 꼽은 항목이다. */
export function hasMetricValue(value) {
  const text = clean(value).replace(DATE_LIKE, ' ');
  return METRIC_UNIT.test(text) || METRIC_RATIO.test(text);
}

/* 데이터가 아니라 느낌으로 쓴 문제 정의 — UX 직군에서 당락을 가른 지점.
   같은 문장에 수치가 함께 있으면 근거가 붙은 것으로 본다. */
const VAGUE_PROBLEM = /불편|복잡|아쉽|부족(?:해|한|하다|했)|어렵|힘들|답답|느낌|같아서|보였|생각[이했]/;

export const PORTFOLIO_SLOT_META = {
  flagship: {
    label: '대표 성과',
    description: '가장 강한 결과와 직무 적합성을 보여주는 경험',
  },
  problem_solving: {
    label: '문제 해결',
    description: '문제를 정의하고 대안을 선택해 해결한 경험',
  },
  collaboration: {
    label: '협업·조율',
    description: '팀원이나 이해관계자와 결과를 만든 경험',
  },
  growth: {
    label: '성장·주도성',
    description: '학습, 실패, 오너십 또는 다음 판단을 보여주는 경험',
  },
};

export const PORTFOLIO_SLOT_ORDER = Object.keys(PORTFOLIO_SLOT_META);

const SLOT_PATTERNS = {
  flagship: /성과|결과|향상|증가|감소|개선|달성|출시|전환|매출|절감|수상|metric|result|impact|launch|growth/i,
  problem_solving: /문제|해결|가설|분석|원인|실험|장애|개선|최적화|의사결정|problem|solve|analysis|experiment|debug/i,
  collaboration: /협업|팀원|조율|설득|소통|이해관계자|디자이너|개발자|고객|리뷰|collabor|stakeholder|team|communicat/i,
  growth: /성장|학습|배움|회고|실패|주도|오너십|리드|도전|다음|learning|ownership|lead|retrospect/i,
};

/* 직무별 결정타 — 심사자가 그 직무에서만 특별히 확인한다고 반복해서 언급한 항목.
   슬롯(대표 성과·문제 해결·협업·성장)은 직무 공통이라 이 층이 따로 필요하다. */
const JOB_FOCUS = {
  troubleshooting: {
    label: '트러블슈팅',
    pattern: /장애|버그|에러|오류|병목|지연|재현|디버깅|리팩터|최적화|근본\s*원인|롤백|troubleshoot|debug|latency|bottleneck/i,
    hint: '막혔던 문제와 원인을 어떻게 좁혔는지 한 단락 넣어보세요. 개발 서류에서 가장 먼저 확인하는 항목이에요.',
  },
  business_link: {
    label: '비즈니스 문제 연결',
    pattern: /매출|비용|전환|리텐션|이탈|고객|사용자\s*수|수익|비즈니스|의사결정|가설\s*검증|kpi/i,
    hint: '분석이 어떤 비즈니스 판단으로 이어졌는지 적어주세요. 기법 설명만으로는 평가되지 않습니다.',
  },
  prioritization: {
    label: '우선순위 근거',
    pattern: /우선순위|먼저|범위|스코프|mvp|트레이드오프|포기|제외|기준으로\s*정|선택했|의사결정/i,
    hint: '여러 안 중에 왜 이걸 먼저 했는지 적어주세요. 기획 직무는 결과보다 판단의 근거를 봅니다.',
  },
  research_basis: {
    label: '리서치 근거',
    pattern: /인터뷰|설문|사용성\s*테스트|리서치|관찰|로그\s*분석|a\/b|사용자\s*\d|응답자|테스트\s*참여/i,
    hint: '문제를 어떻게 확인했는지(인터뷰·테스트·로그) 근거를 붙여주세요. 디자인 직군의 첫 평가 지점입니다.',
  },
  campaign_metric: {
    label: '캠페인 지표',
    pattern: /roas|ctr|cpc|cpa|cvr|전환율|노출|클릭|예산|입찰|소재|타겟팅|a\/b/i,
    hint: '지표를 보고 무엇을 바꿨는지(소재·타겟·입찰) 최적화 과정을 적어주세요. 집행 결과만으로는 부족합니다.',
  },
};

const JOB_FOCUS_BY_CATEGORY = {
  dev: 'troubleshooting',
  devops: 'troubleshooting',
  aiml: 'troubleshooting',
  security: 'troubleshooting',
  qa: 'troubleshooting',
  engineering: 'troubleshooting',
  da: 'business_link',
  finance: 'business_link',
  sales: 'business_link',
  pm: 'prioritization',
  project: 'prioritization',
  strategy: 'prioritization',
  operations: 'prioritization',
  designer: 'research_basis',
  content: 'research_basis',
  research: 'research_basis',
  marketer: 'campaign_metric',
};

export function resolveJobFocus(experience = {}) {
  const category = experience.jobCategory || experience.structuredResult?.jobCategory || 'common';
  const key = JOB_FOCUS_BY_CATEGORY[category];
  return key ? { key, ...JOB_FOCUS[key] } : null;
}

export function evaluateExperienceReadiness(experience = {}) {
  const sr = experience.structuredResult || {};
  const overview = sr.projectOverview || {};
  const keyExperiences = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];

  const contextText = textOf([
    overview.background,
    overview.goal,
    sr.intro,
    sr.overview,
    sr.task,
    experience.content?.problem,
    experience.content?.context,
  ]);
  const roleText = textOf([
    overview.role,
    overview.team,
    sr.competency,
    experience.content?.role,
  ]);
  const actionText = textOf([
    ...keyExperiences.map(item => item?.action),
    sr.process,
    experience.content?.action,
  ]);
  const outcomeText = textOf([
    ...keyExperiences.flatMap(item => [item?.result, item?.learning, item?.metric]),
    sr.output,
    sr.growth,
    experience.content?.outcome,
    experience.content?.result,
  ]);
  const artifactAttached = Boolean(
    experience.link
    || experience.notionDoc
    || experience.content?.sourceUrl
    || experience.sourceArtifactIds?.length
    || experience.images?.length
    || experience.sectionImages
    || experience.keyExpImages
  );
  const evidenceConfirmed = Boolean(
    experience.confirmedAt
    || experience.readiness?.evidenceConfirmed
    || experience.lifecycleStatus === 'portfolio_ready'
  );

  const checks = {
    context: meaningful(contextText),
    role: meaningful(roleText, 2),
    action: meaningful(actionText),
    outcomeOrLearning: meaningful(outcomeText),
    outcomeMetric: hasMetricValue(outcomeText),
    evidenceConfirmed,
    artifactAttached,
  };
  // 필수 항목은 그대로 둔다 — 수치는 점수와 보완 제안으로만 압박한다.
  const requiredKeys = ['context', 'role', 'action', 'outcomeOrLearning'];
  const requiredComplete = requiredKeys.every(key => checks[key]);
  const score = Math.round(
    (checks.context ? 20 : 0)
    + (checks.role ? 20 : 0)
    + (checks.action ? 20 : 0)
    + (checks.outcomeOrLearning ? 20 : 0)
    + (checks.outcomeMetric ? 10 : 0)
    + (checks.evidenceConfirmed ? 5 : 0)
    + (checks.artifactAttached ? 5 : 0)
  );
  const explicitStatus = experience.lifecycleStatus;
  const lifecycleStatus = explicitStatus
    || (experience.structuredResult ? 'needs_confirmation' : 'captured');
  const portfolioReady = lifecycleStatus === 'portfolio_ready' && requiredComplete;
  const missing = requiredKeys.filter(key => !checks[key]);
  const allText = textOf([
    experience.title,
    experience.keywords,
    experience.competencyTags,
    experience.workStyleTags,
    overview,
    keyExperiences,
    sr.task,
    sr.process,
    sr.output,
    sr.growth,
  ]);
  const roleScores = Object.fromEntries(
    PORTFOLIO_SLOT_ORDER.map(slot => {
      const matches = allText.match(new RegExp(SLOT_PATTERNS[slot].source, 'gi')) || [];
      return [slot, matches.length];
    })
  );
  const portfolioRoles = Array.isArray(experience.portfolioRoles) && experience.portfolioRoles.length
    ? experience.portfolioRoles.filter(role => PORTFOLIO_SLOT_META[role])
    : PORTFOLIO_SLOT_ORDER
      .filter(slot => roleScores[slot] > 0)
      .sort((a, b) => roleScores[b] - roleScores[a])
      .slice(0, 2);

  const focus = resolveJobFocus(experience);
  const jobFocus = focus
    ? { ...focus, met: focus.pattern.test(`${actionText} ${outcomeText} ${contextText}`) }
    : null;
  const vagueProblem = checks.context
    && VAGUE_PROBLEM.test(contextText)
    && !hasMetricValue(contextText);

  /* 보완 제안 — 통과/실패가 아니라 "무엇을 더 쓰면 서류가 강해지는지".
     리서치에서 반복 확인된 우선순위 그대로 정렬한다. */
  const suggestions = [
    !checks.outcomeMetric && checks.outcomeOrLearning && {
      key: 'outcomeMetric',
      label: '결과에 숫자가 없어요',
      hint: '숫자가 없으면 심사에서 빈칸으로 읽힙니다. 매출·전환율이 없다면 소요 시간 단축, 처리 건수, 참여 인원, 전후 비교로 대체할 수 있어요.',
    },
    vagueProblem && {
      key: 'vagueProblem',
      label: '문제가 느낌으로 적혀 있어요',
      hint: '“불편했다” 대신 무엇이 얼마나 문제였는지 적어보세요. 예: “탐색에 평균 15초 — 원인은 3뎁스 메뉴 구조”.',
    },
    jobFocus && !jobFocus.met && {
      key: 'jobFocus',
      label: `${jobFocus.label}이(가) 빠져 있어요`,
      hint: jobFocus.hint,
    },
    !checks.artifactAttached && {
      key: 'artifactAttached',
      label: '근거 자료가 없어요',
      hint: '결과물 링크나 화면 캡처를 붙이면 같은 문장도 검증 가능한 사실로 읽힙니다.',
    },
  ].filter(Boolean);

  return {
    checks,
    requiredComplete,
    score,
    lifecycleStatus,
    portfolioReady,
    missing,
    suggestions,
    jobFocus,
    portfolioRoles: portfolioRoles.length ? portfolioRoles : ['growth'],
    preview: {
      title: clean(experience.title) || '제목 없는 경험',
      context: clean(contextText),
      role: clean(roleText),
      action: clean(actionText),
      outcome: clean(outcomeText),
    },
  };
}

function chooseExperiencesForSlots(readyItems) {
  const selected = [];
  const used = new Set();

  for (const slot of PORTFOLIO_SLOT_ORDER) {
    const match = readyItems
      .filter(item => !used.has(item.experience.id))
      .sort((a, b) => {
        const aHas = a.readiness.portfolioRoles.includes(slot) ? 1 : 0;
        const bHas = b.readiness.portfolioRoles.includes(slot) ? 1 : 0;
        return bHas - aHas || b.readiness.score - a.readiness.score;
      })[0];
    if (match && match.readiness.portfolioRoles.includes(slot)) {
      selected.push(match.experience);
      used.add(match.experience.id);
    }
  }

  for (const item of [...readyItems].sort((a, b) => b.readiness.score - a.readiness.score)) {
    if (selected.length >= 4) break;
    if (!used.has(item.experience.id)) {
      selected.push(item.experience);
      used.add(item.experience.id);
    }
  }

  return selected;
}

export function buildPortfolioReadiness(experiences = []) {
  const items = experiences.map(experience => ({
    experience,
    readiness: evaluateExperienceReadiness(experience),
  }));
  const readyItems = items.filter(item => item.readiness.portfolioReady);
  const confirmableItems = items.filter(item => !item.readiness.portfolioReady && item.readiness.requiredComplete);
  const coveredSlots = new Set(readyItems.flatMap(item => item.readiness.portfolioRoles));
  const missingSlots = PORTFOLIO_SLOT_ORDER.filter(slot => !coveredSlots.has(slot));
  const countProgress = Math.min(1, readyItems.length / 3);
  const coverageProgress = coveredSlots.size / PORTFOLIO_SLOT_ORDER.length;
  const progress = Math.round((countProgress * 0.65 + coverageProgress * 0.35) * 100);
  const ready = readyItems.length >= 3 && coveredSlots.size >= 3;
  const strong = readyItems.length >= 4 && coveredSlots.size === PORTFOLIO_SLOT_ORDER.length;

  return {
    items,
    totalCount: experiences.length,
    readyCount: readyItems.length,
    draftCount: experiences.length - readyItems.length,
    confirmableCount: confirmableItems.length,
    coveredSlots: [...coveredSlots],
    missingSlots,
    nextSlot: missingSlots[0] || null,
    progress,
    status: strong ? 'strong' : ready ? 'ready' : 'collecting',
    ready,
    strong,
    suggestedExperiences: chooseExperiencesForSlots(readyItems),
  };
}

export function readinessPatch(experience, { confirmed = false } = {}) {
  const evaluated = evaluateExperienceReadiness({
    ...experience,
    ...(confirmed ? { lifecycleStatus: 'portfolio_ready', confirmedAt: new Date().toISOString() } : {}),
  });
  const confirmedAt = confirmed ? new Date().toISOString() : experience.confirmedAt || null;
  return {
    lifecycleStatus: confirmed && evaluated.requiredComplete ? 'portfolio_ready' : 'needs_confirmation',
    confirmedAt: confirmed && evaluated.requiredComplete ? confirmedAt : null,
    portfolioRoles: evaluated.portfolioRoles,
    readiness: {
      ...evaluated.checks,
      evidenceConfirmed: confirmed && evaluated.requiredComplete,
      score: confirmed && evaluated.requiredComplete ? Math.max(evaluated.score, 95) : evaluated.score,
      evaluatedAt: new Date().toISOString(),
      evaluatorVersion: 1,
    },
  };
}

export function readinessLabel(key) {
  return {
    context: '배경 또는 문제',
    role: '나의 역할',
    action: '행동과 판단',
    outcomeOrLearning: '결과 또는 배운 점',
    outcomeMetric: '결과의 수치',
    evidenceConfirmed: '사실 확인',
    artifactAttached: '자료·링크 보강',
  }[key] || key;
}
