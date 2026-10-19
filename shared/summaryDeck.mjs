// 경험 요약 슬라이드(요약 덱) — 사용자가 정리한 경험에서만 재료를 모아 슬라이드 구성을 정한다.
// 디자인은 프론트 템플릿(SummaryDeckSlides)이 고정으로 그리고, 여기서는
// "어떤 장을 만들지 + 각 칸에 들어갈 원문"만 정한다. 데이터가 없는 장은 만들지 않는다.
// AI(백엔드)는 칸의 원문을 줄이기만 하고, applyDeckCopy 가 새 숫자·과장 표현이 섞인 문구를 버린다.

// 분석 단계에서 빈칸에 넣어 둔 안내 문구("결과물과 성과 지표를 보강해 주세요." 등)는 내용이 아니므로 버린다.
const PLACEHOLDER_SENTENCE = /[^.\n]*(보강|입력|작성|채워|추가)해 ?주세요\.?/g;
const UNCONFIRMED = /[[(]?확인 필요[\])]?/g;
const str = value => {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return '';
  return value.replace(PLACEHOLDER_SENTENCE, '').replace(UNCONFIRMED, '').replace(/\n{3,}/g, '\n\n').trim();
};
const arr = value => (Array.isArray(value) ? value : []);
const firstOf = (...values) => values.map(str).find(Boolean) || '';
// 외부 주소 이미지와, 예전 경험에 문서째 저장된 data: 이미지 모두 쓴다.
const isImageUrl = url => /^(https?:\/\/|data:image\/)/.test(url);
const toImage = im => ({ url: str(im?.url || im), caption: str(im?.caption || im?.name) });

// 문장 하나만 꺼낸다 (한국어 "~다." / 영문 마침표 기준)
function firstSentence(text) {
  const value = str(text).replace(/\s+/g, ' ');
  const match = value.match(/^.+?[.!?。](?=\s|$)/);
  return (match ? match[0] : value).trim();
}

// max 글자 안으로 자른다. 문장·쉼표 경계를 우선하고, 그래도 길면 단어 경계에서 자르고 말줄임표를 붙인다.
export function clampText(text, max) {
  const value = str(text).replace(/\s+/g, ' ');
  if (value.length <= max) return value;
  const head = value.slice(0, max);
  const boundary = Math.max(head.lastIndexOf('. '), head.lastIndexOf('다.'), head.lastIndexOf(', '));
  if (boundary >= max * 0.6) return head.slice(0, boundary + 1).replace(/[,\s]+$/, '').trim();
  const space = head.lastIndexOf(' ');
  return `${head.slice(0, space > max * 0.5 ? space : max - 1).trim()}…`;
}

const noPeriod = text => str(text).replace(/[.。]+$/, '');

// 숫자 토큰 (쉼표 제거) — 문구 검증용
function numberTokens(text) {
  return [...str(text).matchAll(/\d+(?:[.,]\d+)*/g)].map(m => m[0].replace(/,/g, ''));
}

function parseNumber(value) {
  const match = str(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function hashString(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

/* ───────────────────────── 재료 모으기 ───────────────────────── */

function normalizeKeyExperience(k = {}) {
  const trace = k.decisionTrace || {};
  const jobData = k.jobData || {};
  return {
    title: str(k.title),
    metric: str(k.metric),
    metricLabel: str(k.metricLabel),
    before: str(k.beforeMetric),
    after: str(k.afterMetric),
    context: firstOf(k.context, k.situation, k.problem),
    action: firstOf(k.action, k.task),
    result: firstOf(k.result, k.outcome),
    learning: firstOf(k.learning, k.growth),
    jobData,
    trace,
    quote: str(k.voiceRecord?.originalQuote),
    evidence: arr(k.evidenceBundle),
    review: k.honestReview || {},
    identity: str(k.identitySignal?.sentence),
    images: arr(k.images).map(toImage).filter(im => isImageUrl(im.url)),
  };
}

/**
 * Firestore 경험 문서(또는 같은 모양의 객체)에서 슬라이드 재료를 모은다.
 * 경험 문서: { title, jobCategory, structuredResult, caseStudy, keyExpImages, images }
 */
export function collectDeckMaterial(experience = {}) {
  const sr = experience.structuredResult || {};
  const overview = sr.projectOverview || {};
  const keyExps = arr(sr.keyExperiences).map(normalizeKeyExperience);

  // 핵심 경험 사진: structuredResult → 케이스 스터디 편집본 → 인덱스별 저장본 순으로 합친다.
  const caseKeyExps = arr(experience.caseStudy?.keyExps);
  keyExps.forEach((k, i) => {
    const extra = [
      ...arr(caseKeyExps[i]?.images),
      ...arr(experience.keyExpImages?.[String(i)]),
    ].map(toImage).filter(im => isImageUrl(im.url));
    const seen = new Set(k.images.map(im => im.url));
    extra.forEach(im => { if (!seen.has(im.url)) { seen.add(im.url); k.images.push(im); } });
  });
  const images = [
    ...keyExps.flatMap(k => k.images),
    ...arr(experience.images).map(toImage).filter(im => isImageUrl(im.url)),
    ...Object.values(experience.sectionImages || {}).flatMap(list => arr(list).map(toImage)).filter(im => isImageUrl(im.url)),
  ].filter((im, i, all) => all.findIndex(other => other.url === im.url) === i);

  const pv = sr.portfolioVisuals || {};
  const funnel = arr(pv.funnel?.stages || pv.funnel)
    .map(s => ({ label: str(s?.label), value: parseNumber(s?.value) }))
    .filter(s => s.label && s.value != null);
  const compare = arr(pv.compare).map(c => ({ label: str(c?.label), before: str(c?.before), after: str(c?.after), unit: str(c?.unit) }))
    .filter(c => c.label && c.before && c.after);
  keyExps.forEach(k => {
    if (k.before && k.after && !compare.some(c => c.after === k.after)) {
      compare.push({ label: k.metricLabel || k.title, before: k.before, after: k.after, unit: '' });
    }
  });
  const kpis = [
    ...arr(pv.kpis).map(m => ({ label: firstOf(m?.label, m?.name), value: str(m?.value) })),
    ...keyExps.filter(k => k.metric).map(k => ({ label: k.metricLabel || k.title, value: k.metric })),
  ].filter(m => m.label && m.value && !/확인 필요/.test(m.value))
    .filter((m, i, all) => all.findIndex(other => other.value === m.value) === i);
  const steps = arr(pv.process?.steps || pv.steps)
    .map(s => ({ label: str(s?.label), desc: str(s?.desc) }))
    .filter(s => s.label);

  const research = arr(sr.marketResearch?.deskResearchInfographic?.cards)
    .filter(c => str(c?.sourceUrl) && (c?.value != null || arr(c?.bars).length))
    .map(c => ({
      question: str(c.question),
      finding: str(c.finding),
      chartType: str(c.chartType) || (arr(c.bars).length ? 'bar' : 'stat'),
      value: c.value,
      unit: str(c.unit),
      valueLabel: str(c.valueLabel),
      bars: arr(c.bars).map(b => ({ label: str(b?.label), value: parseNumber(b?.value), unit: str(b?.unit) })).filter(b => b.label && b.value != null),
      source: firstOf(c.sourcePublisher, c.sourceTitle),
      checkedAt: str(c.checkedAt),
    }));

  return {
    title: firstOf(experience.title, sr.title, keyExps[0]?.title),
    period: firstOf(overview.duration, experience.period),
    role: str(overview.role),
    team: str(overview.team),
    summary: firstOf(overview.summary, sr.intro),
    goal: str(overview.goal),
    background: firstOf(overview.background, sr.overview),
    scope: str(overview.scopeOfImpact),
    process: str(sr.process),
    // 예전(핵심 경험 1개·수치 없음) 경험이 주로 가진 재료
    sections: { overview: str(sr.overview), task: str(sr.task), process: str(sr.process), output: str(sr.output), growth: str(sr.growth) },
    processCards: arr(sr.sectionSlides?.process?.evidenceCards)
      .map(c => ({ label: firstOf(c?.title, c?.label), desc: str(c?.body) })).filter(c => c.label && c.desc),
    highlights: arr(sr.highlights)
      .map(h => (typeof h === 'string' ? { label: '', text: str(h) } : { label: str(h?.field), text: str(h?.text) })).filter(h => h.text),
    researchTitle: firstOf(sr.marketResearch?.deskResearchInfographic?.title, sr.marketResearch?.deskResearchInfographic?.conclusion),
    keyExps,
    funnel,
    compare,
    kpis,
    steps,
    research,
    images,
  };
}

/* ───────────────────────── 덱 구성 ───────────────────────── */

// 칸 하나: 결정론 값(원문 발췌) + AI 가 줄일 원문(_src) + 최대 글자 수 + 문체 종류
function slot(source, max, kind = 'body') {
  const src = str(source);
  if (!src) return null;
  const sentence = kind === 'body' ? clampText(src, max) : noPeriod(clampText(firstSentence(src), max));
  return { text: sentence, src, max, kind };
}

// 제목·캡션 칸: 후보 원문 중 자르지 않고 들어가는 첫 문장을 고른다(말줄임표 방지).
// AI 에게는 가장 풍부한 첫 후보를 원문으로 넘긴다.
// 들어가는 원문이 없으면 fallback(그 장이 보여주는 내용을 말하는 고정 제목)을 쓴다.
function fitSlot(candidates, max, kind = 'title', fallback = '') {
  const sources = candidates.map(str).filter(Boolean);
  if (!sources.length) return fallback ? { text: fallback, src: '', max, kind } : null;
  const fitting = sources.map(s => noPeriod(firstSentence(s))).find(s => s.length <= max);
  return { text: fitting || fallback || noPeriod(clampText(firstSentence(sources[0]), max)), src: sources[0], max, kind };
}

function problemVoices(m) {
  const voices = [];
  for (const k of m.keyExps) {
    if (k.quote) voices.push({ text: { text: clampText(k.quote, 70), src: k.quote, max: 70, kind: 'quote' }, who: '직접 들은 말' });
    if (k.trace.problemEvidence) voices.push({ text: slot(k.trace.problemEvidence, 50), who: '근거' });
    if (k.jobData.painPoint) voices.push({ text: slot(k.jobData.painPoint, 50), who: '불편' });
    k.evidence.filter(e => e?.claim).slice(0, 2).forEach(e => voices.push({ text: slot(e.claim, 50), who: firstOf(e.sourceRef, e.type, '근거') }));
  }
  if (voices.length < 2) m.keyExps.filter(k => k.context).forEach(k => voices.push({ text: slot(k.context, 50), who: k.title ? clampText(k.title, 16) : '상황' }));
  if (voices.length < 2) {
    [[m.scope, '영향 범위'], [m.sections.task, '맡은 일'], [m.goal, '목표']]
      .filter(([text]) => text && text !== m.background)
      .forEach(([text, who]) => voices.push({ text: slot(text, 50), who }));
  }
  return voices.filter(v => v.text).filter((v, i, all) => all.findIndex(o => o.text.src === v.text.src) === i).slice(0, 3);
}

// 근거 카드 아래 한 줄 — 카드에 이미 있는 문장은 다시 쓰지 않는다. AI 에게는 카드 문장 전체를 요약 재료로 준다.
function voicesSummary(voices, candidates) {
  const used = new Set(voices.map(v => noPeriod(v.text.src)));
  const fitting = candidates.map(str).filter(Boolean).map(c => noPeriod(firstSentence(c)))
    .find(c => c.length <= 28 && !used.has(c) && !voices.some(v => v.text.src.includes(c)));
  return { text: fitting || '', src: voices.map(v => v.text.src).join(' / '), max: 28, kind: 'caption' };
}

// 차트 아래 캡션의 기본값 — 데이터에서 바로 읽히는 사실만 쓴다.
function chartCaption(chart) {
  if (chart.kind === 'funnel') {
    let drop = 1;
    for (let i = 1; i < chart.data.length; i++) {
      if (chart.data[i - 1].value - chart.data[i].value > chart.data[drop - 1].value - chart.data[drop].value) drop = i;
    }
    return `${chart.data[drop - 1].label} → ${chart.data[drop].label} 구간에서 가장 많이 감소`;
  }
  return `${chart.data[0].label} 변화`;
}

function hypothesisSource(lead, m) {
  return firstOf(lead.jobData.hypothesis, lead.trace.choice, lead.jobData.decision, m.goal, lead.action);
}

function buildSlides(m) {
  const slides = [];
  const lead = m.keyExps[0] || normalizeKeyExperience();

  // 1) 표지 — 항상
  slides.push({
    type: 'cover',
    title: { text: clampText(m.title || '나의 경험', 30), src: m.title, max: 30, kind: 'title' },
    subtitle: null,
    subtitleCandidates: [m.summary, m.goal, lead.result, m.sections.output].map(str).filter(Boolean),
    meta: [
      m.role && { label: '역할', value: clampText(m.role, 28) },
      m.team && { label: '팀', value: clampText(m.team, 28) },
      m.period && { label: '기간', value: clampText(m.period, 28) },
    ].filter(Boolean),
    kpis: m.kpis.slice(0, 3).map(k => ({ label: clampText(k.label, 18), value: clampText(k.value, 14) })),
  });

  // 2) 문제 정의 — 문제 문장이 있고, 차트나 목소리(근거) 2개 이상이 있을 때
  const problemText = firstOf(lead.trace.problemJudgment, lead.jobData.painPoint, lead.context, m.background);
  const voices = problemVoices(m).filter(v => v.text.src !== hypothesisSource(lead, m));
  const chart = m.funnel.length >= 3
    ? { kind: 'funnel', data: m.funnel.slice(0, 5) }
    : m.compare.some(c => parseNumber(c.before) != null && parseNumber(c.after) != null)
      ? { kind: 'compare', data: m.compare.filter(c => parseNumber(c.before) != null && parseNumber(c.after) != null).slice(0, 3) }
      : null;
  // 강조 카드 라벨은 원문의 성격대로 — 실제 가설이 아니면 '가설'이라 부르지 않는다.
  const [hypothesis, hypothesisLabel] = [
    [lead.jobData.hypothesis, '가설'], [lead.trace.choice, '결정'], [lead.jobData.decision, '결정'], [m.goal, '목표'], [lead.action, '실행'],
  ].map(([value, label]) => [str(value), label]).find(([value]) => value) || ['', ''];
  const briefOnly = !chart && voices.length < 2;
  if (problemText && (chart || voices.length >= 2 || hypothesis)) {
    slides.push({
      type: 'problem',
      // 근거 카드가 모자라는 경험: 상황 문장을 큰 카드 하나로 보여준다
      statement: briefOnly ? slot(problemText, 150) : null,
      title: fitSlot([problemText, lead.jobData.painPoint], 24, 'title', chart && voices.length >= 2 ? '데이터와 인터뷰로 찾은 문제' : chart ? '데이터로 찾은 문제' : '직접 확인한 문제'),
      lead: slot(firstOf(m.background, lead.context, problemText), 90),
      chart: chart && { ...chart, caption: fitSlot([problemText, lead.jobData.painPoint], 28, 'caption', chartCaption(chart)) },
      voices: briefOnly ? [] : voices,
      voicesCaption: briefOnly ? null : voices.length ? voicesSummary(voices, [lead.trace.problemEvidence, lead.jobData.painPoint, problemText]) : null,
      hypothesis: hypothesis ? slot(hypothesis, 48, 'body') : null,
      hypothesisLabel,
    });
  }

  // 3) 배경 리서치 — 출처가 확인된 외부 통계 카드가 2개 이상일 때만
  if (m.research.length >= 2) {
    slides.push({
      type: 'research',
      title: fitSlot([m.researchTitle, m.background], 44, 'title', '시장 데이터로 본 배경'),
      cards: m.research.slice(0, 3).map(c => ({
        ...c,
        question: clampText(c.question, 40),
        finding: fitSlot([c.finding, c.valueLabel], 44, 'caption'),
      })),
    });
  }

  // 4) 과정 — 실행→결과 짝이 2개 이상이면 짝 카드, 아니면 단계 흐름
  const pairs = m.keyExps.filter(k => k.action && (k.result || k.metric));
  const traceSteps = [
    lead.trace.problemJudgment && { label: '문제 판단', desc: lead.trace.problemJudgment },
    arr(lead.trace.alternatives).length && { label: '대안 검토', desc: arr(lead.trace.alternatives).map(a => str(a?.option)).filter(Boolean).join(' / ') },
    arr(lead.trace.decisionCriteria).length && { label: '선택 기준', desc: arr(lead.trace.decisionCriteria).map(c => str(c?.criterion)).filter(Boolean).join(' / ') },
    lead.trace.choice && { label: '결정', desc: lead.trace.choice },
    lead.trace.execution && { label: '실행', desc: lead.trace.execution },
  ].filter(s => s && str(s.desc));
  const sectionFlow = [
    { label: '맡은 일', desc: m.sections.task },
    { label: '진행 방식', desc: m.sections.process },
    { label: '결과', desc: firstOf(m.sections.output, lead.result) },
  ].filter((s, i, all) => s.desc && all.findIndex(o => o.desc === s.desc) === i);
  const steps = [m.steps, traceSteps, m.processCards, sectionFlow].find(list => list.length >= 3) || [];
  if (pairs.length >= 2) {
    slides.push({
      type: 'process',
      variant: 'pairs',
      title: fitSlot([m.process, m.goal], 36, 'title', '무엇을 했고, 무엇이 바뀌었나'),
      pairs: pairs.slice(0, 3).map(k => ({
        action: { title: fitSlot([k.title, k.action], 18), desc: slot(k.action, 64) },
        outcome: { title: fitSlot([k.metric && `${k.metricLabel ? `${k.metricLabel} ` : ''}${k.metric}`, k.metric, k.result], 20), desc: slot(k.result || k.metric, 64) },
      })),
    });
  } else if (steps.length >= 3) {
    slides.push({
      type: 'process',
      // 피라미드는 원래 '단계' 데이터일 때만 — 섹션 흐름처럼 위계가 없는 순서는 가로 흐름으로
      variant: steps === m.steps && steps.length <= 4 ? 'pyramid' : 'flow',
      title: fitSlot([m.process, m.goal], 36, 'title', '문제를 푼 과정'),
      steps: steps.slice(0, 5).map(s => ({ title: slot(s.label, 14, 'title'), desc: slot(s.desc, 56) })),
    });
  }

  // 5) AS-IS → TO-BE — 사용자가 올린 결과물 이미지가 있을 때만
  if (m.images.length) {
    const beforeImage = m.images.find(im => /before|as-?is|기존|이전|개선 ?전/i.test(im.caption));
    const afterImages = m.images.filter(im => im !== beforeImage).slice(0, 2);
    // 강조 항목: 바로 위 설명과 다른 내용이 2개 이상일 때만 싣는다(같은 문장 반복 방지).
    const toBeDesc = firstOf(lead.action, m.summary);
    const candidates = m.steps.length >= 2
      ? m.steps.map(s => ({ tag: s.label, text: s.desc || s.label }))
      : [
        { tag: '결정', text: lead.trace.choice || lead.jobData.decision },
        { tag: '실행', text: lead.trace.execution },
        { tag: '검증', text: lead.jobData.validation || lead.jobData.testResult || lead.trace.outcomeEvidence },
        ...m.keyExps.slice(1).filter(k => k.action).map((k, i) => ({ tag: `실행 ${String(i + 2).padStart(2, '0')}`, text: k.action })),
      ];
    const distinct = candidates.filter(p => str(p.text) && noPeriod(p.text) !== noPeriod(toBeDesc))
      .filter((p, i, all) => all.findIndex(o => o.text === p.text) === i);
    const points = distinct.length >= 2 ? distinct.slice(0, 3) : [];
    slides.push({
      type: 'solution',
      asIs: {
        title: fitSlot([problemText, lead.jobData.painPoint, lead.context], 22, 'title', '기존 방식의 문제'),
        desc: slot(firstOf(lead.context, m.background), 80),
        image: beforeImage ? m.images.indexOf(beforeImage) : null,
      },
      toBe: {
        title: fitSlot([lead.jobData.decision, lead.trace.choice, lead.action, m.goal], 22, 'title', '바꾼 방식'),
        desc: slot(toBeDesc, 80),
        points: points.map(p => ({ tag: fitSlot([p.tag], 12, 'title', '포인트'), text: slot(p.text, 56) })),
        images: afterImages.map(im => m.images.indexOf(im)),
      },
    });
  }

  // 6) 성과 — 수치가 하나라도 있을 때
  const compares = m.compare.slice(0, 3).map(c => ({ label: clampText(c.label, 20), before: clampText(c.before, 14), after: clampText(c.after, 14), unit: c.unit }));
  const learning = firstOf(lead.trace.newPrinciple, lead.learning, lead.review.nextTime, lead.identity);
  if (compares.length || m.kpis.length) {
    slides.push({
      type: 'result',
      title: fitSlot([lead.result, m.summary], 30, 'title', '숫자로 본 변화'),
      compares,
      kpis: compares.length ? m.kpis.filter(k => !compares.some(c => c.after === k.value)).slice(0, 2) : m.kpis.slice(0, 3),
      learning: learning ? slot(learning, 64) : null,
    });
  } else {
    // 수치가 없는 경험 — 정리해 둔 결과 문장·하이라이트를 카드로 보여준다
    const notes = [
      ...m.highlights.map(h => ({ label: h.label, text: h.text })),
      { label: '결과', text: firstOf(lead.result, m.sections.output) },
    ].filter((n, i, all) => n.text && all.findIndex(o => o.text === n.text) === i).slice(0, 3);
    const growth = firstOf(learning, m.sections.growth);
    if (notes.length >= 2 || (notes.length && growth)) {
      slides.push({
        type: 'result',
        title: fitSlot([lead.result, m.sections.output], 30, 'title', growth ? '해낸 것과 배운 것' : '정리한 결과'),
        compares: [],
        kpis: [],
        notes: notes.map((n, i) => ({ label: fitSlot([n.label], 10, 'title', String(i + 1).padStart(2, '0')), text: slot(n.text, 90) })),
        learning: growth ? slot(growth, 64) : null,
      });
    }
  }

  return dedupeSlides(slides).map((s, i) => ({ id: `${s.type}-${i}`, ...s }));
}

// 같은 문장이 여러 칸에 나오지 않게 한다. 앞 장(앞 칸)을 남기고, 뒤의 중복은
// 카드형 항목이면 빼고 설명형 칸이면 비운다. 제목·라벨은 짧아서 겹쳐도 둔다.
const SKIP_DEDUPE = /^(title|label|tag|hypothesis)$/;
function dedupeSlides(slides) {
  const seen = new Set();
  const norm = text => noPeriod(text).replace(/\s+/g, ' ');
  // 본문 장을 먼저 채우고 표지는 마지막에 — 표지 부제는 다른 장과 겹치지 않는 문장으로 고른다
  for (const slide of [...slides.filter(s => s.type !== 'cover'), ...slides.filter(s => s.type === 'cover')]) {
    if (slide.subtitleCandidates) {
      const pick = slide.subtitleCandidates.find(c => !seen.has(norm(c)) && !seen.has(norm(clampText(c, 80))));
      slide.subtitle = pick ? slot(pick, 80) : null;
      delete slide.subtitleCandidates;
    }
    const drop = [];
    for (const { path, slot } of listDeckSlots({ slides: [slide] })) {
      const field = path.split('.').slice(2);
      if (!slot.text || SKIP_DEDUPE.test(field.at(-1))) continue;
      // 원문이 달라도 잘라낸 문장이 같으면 같은 문장으로 본다
      const keys = [norm(slot.src), norm(slot.text)].filter(Boolean);
      if (!keys.some(k => seen.has(k))) { keys.forEach(k => seen.add(k)); continue; }
      drop.push(field);
    }
    for (const field of drop.reverse()) {
      const [head, index] = field;
      if (['voices', 'notes'].includes(head)) slide[head][index] = null;
      else if (head === 'toBe' && field[1] === 'points') slide.toBe.points[field[2]] = null;
      else {
        let node = slide;
        field.slice(0, -1).forEach(k => { node = node?.[k]; });
        if (node) node[field.at(-1)] = null;
      }
    }
    if (slide.voices) slide.voices = slide.voices.filter(Boolean);
    if (slide.notes) slide.notes = slide.notes.filter(Boolean);
    if (slide.toBe?.points) slide.toBe.points = slide.toBe.points.filter(Boolean);
  }
  return slides.filter(s => {
    if (s.type === 'problem') return s.chart || s.voices?.length || s.statement?.text || s.hypothesis?.text;
    if (s.type === 'result') return s.compares?.length || s.kpis?.length || s.notes?.length || s.learning?.text;
    return true;
  });
}

export function deckSourceHash(material) {
  return hashString(JSON.stringify(material));
}

/** 재료에서 결정론 덱(원문 발췌만)을 만든다. AI 가 실패해도 이 덱이 그대로 쓰인다. */
export function planSummaryDeck(material) {
  return { version: 1, title: material.title, sourceHash: deckSourceHash(material), slides: buildSlides(material) };
}

/* ───────────────────────── AI 문구 적용 ───────────────────────── */

// 덱 안의 모든 칸을 경로와 함께 순회한다. 칸 = { text, src, max, kind } 객체.
export function listDeckSlots(deck) {
  const slots = [];
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.text === 'string' && typeof node.src === 'string' && typeof node.max === 'number') {
      if (node.kind !== 'quote' && node.src.length > 0) slots.push({ path, slot: node });
      return;
    }
    for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key);
  };
  walk(deck.slides, 'slides');
  return slots;
}

// 원문에 없는데 결과에 등장하면 버리는 "AI 말투" 표현
const AI_TONE = /혁신|극대화|시너지|획기적|성공적으로|효과적으로|적극적으로|탁월|뛰어난|원활|체계적|도모|제고|견인|고도화|다양한|최적의|크게 기여|이끌어냈|주도적으로|역량을 발휘|한층|더욱|매우/;

/** AI 결과 문구 하나를 검증한다. 통과하면 다듬은 문구, 아니면 null. */
export function validateCopy(candidate, slotInfo) {
  const text = str(candidate).replace(/\s+/g, ' ').replace(/^["'“”]+|["'“”]+$/g, '');
  if (!text) return null;
  if (text.length > Math.ceil(slotInfo.max * 1.15)) return null;
  if (!/[가-힣]/.test(text) && /[가-힣]/.test(slotInfo.src)) return null;
  const sourceNumbers = new Set(numberTokens(slotInfo.src));
  if (numberTokens(text).some(n => !sourceNumbers.has(n))) return null;
  if ((text.match(/["“”]/g) || []).length % 2 === 1) return null; // 잘려서 짝이 안 맞는 따옴표
  const tone = text.match(AI_TONE);
  if (tone && !slotInfo.src.includes(tone[0])) return null;
  return slotInfo.kind === 'body' ? text : noPeriod(text);
}

/** { "slides.1.title": "문구" } 형태의 AI 결과를 덱에 반영한다. 통과 못 한 칸은 원문 발췌를 유지한다. */
export function applyDeckCopy(deck, copies = {}) {
  const next = JSON.parse(JSON.stringify(deck));
  let applied = 0;
  let rejected = 0;
  for (const { path } of listDeckSlots(next)) {
    if (!(path in copies)) continue;
    const node = path.split('.').reduce((obj, key) => obj?.[key], next);
    const value = validateCopy(copies[path], node);
    if (value) { node.text = value; applied++; } else { rejected++; }
  }
  return { deck: next, applied, rejected };
}
