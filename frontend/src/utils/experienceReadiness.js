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
    evidenceConfirmed,
    artifactAttached,
  };
  const requiredKeys = ['context', 'role', 'action', 'outcomeOrLearning'];
  const requiredComplete = requiredKeys.every(key => checks[key]);
  const score = Math.round(
    (checks.context ? 20 : 0)
    + (checks.role ? 20 : 0)
    + (checks.action ? 25 : 0)
    + (checks.outcomeOrLearning ? 25 : 0)
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

  return {
    checks,
    requiredComplete,
    score,
    lifecycleStatus,
    portfolioReady,
    missing,
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
    evidenceConfirmed: '사실 확인',
    artifactAttached: '자료·링크 보강',
  }[key] || key;
}
