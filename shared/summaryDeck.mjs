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
    roleSummary: k.roleSummary && typeof k.roleSummary === 'object' ? k.roleSummary : {},
    images: arr(k.images).map(toImage).filter(im => isImageUrl(im.url)),
  };
}

// 지표 값이 숫자만 있으면("31") 기록된 단위("명")를 붙인다
const withUnit = (value, unit) => {
  const v = str(value), u = str(unit);
  return /^[\d.,+-]+$/.test(v) && /^(%p?|명|건|개|회|원|만원|배|점|초|분|시간|일|주|개월)$/.test(u) ? `${v}${u}` : v;
};

// 마케터 캠페인 재료 — 누구에게(타깃·근거), 어디서(채널·선택 이유), 무엇을(메시지), 목표 대비 성과.
// 한 장 요약에 직접 쓴 내용(roleSummary)을 먼저 쓰고, 없으면 추출된 캠페인 기록을 쓴다.
function collectMarketing(keyExps) {
  for (const k of keyExps) {
    const jd = k.jobData;
    const wp = jd.marketerWorkProducts || {};
    const rs = k.roleSummary;
    const audience = arr(wp.audiences)[0] || {};
    const creative = arr(wp.creatives).find(c => str(c?.hook)) || {};
    const positioning = arr(wp.positioning)[0] || {};
    const rows = arr(wp.channels).map(c => ({ name: str(c?.channel), why: firstOf(c?.rationale, c?.purpose) })).filter(c => c.name);
    const listed = arr(jd.channels)
      .map(c => (typeof c === 'string' ? { name: str(c), why: '' } : { name: firstOf(c?.channel, c?.name), why: firstOf(c?.rationale, c?.why, c?.purpose, c?.role) }))
      .filter(c => c.name && !rows.some(o => o.name.includes(c.name) || c.name.includes(o.name)));
    const target = firstOf(rs.audience, jd.target, audience.segment);
    const channels = [...rows, ...listed];
    const hook = firstOf(rs.message, creative.hook);
    const message = hook || firstOf(positioning.promise, jd.creative);
    if (!target && !channels.length && !message) continue;
    return {
      target,
      insight: firstOf(jd.audienceInsight, [audience.signal, audience.need, audience.barrier].map(str).filter(Boolean).join(' ')),
      channels,
      channelNote: str(rs.channel),
      message,
      messageIsCopy: !!hook,
      messageWhy: firstOf(creative.rationale, positioning.proof),
      problem: str(jd.businessProblem),
      metrics: arr(jd.marketerMetrics).filter(r => str(r?.name) && str(r?.actual) && r.kind !== 'output')
        .map(r => ({ name: str(r.name), baseline: withUnit(r.baseline, r.unit), target: withUnit(r.target, r.unit), actual: withUnit(r.actual, r.unit) })),
      next: str(jd.nextExperiment),
      limit: str(jd.attributionLimit),
      // 과정 장: 실제로 돌린 테스트(가설 → 조건 → 결과 → 결정), 없으면 반응을 보고 고친 기록(신호 → 진단 → 변경 → 다음)
      process: [
        arr(wp.experiments).map(e => [
          { label: '가설', desc: str(e?.hypothesis) },
          { label: '테스트', desc: [str(e?.variable), str(e?.control)].filter(Boolean).join(' · ') || str(e?.test) },
          { label: '결과', desc: str(e?.observation) },
          { label: '결정', desc: str(e?.decision) },
        ]),
        arr(wp.optimization).map(o => [
          { label: '신호', desc: str(o?.signal) },
          { label: '진단', desc: str(o?.diagnosis) },
          { label: '바꾼 것', desc: str(o?.change) },
          { label: '다음', desc: firstOf(o?.observation, o?.next) },
        ]),
      ].map(rows => rows.map(steps => steps.filter(s => s.desc)).find(steps => steps.length >= 3) || null),
    };
  }
  return null;
}

// 사용자가 올린 원문(자료·직접 입력·인터뷰 답변)의 숫자. AI가 뽑은 핵심 경험 구간은 뺀다. 원문이 없으면 null(확인하지 않음).
function rawSourceNumbers(experience) {
  const content = experience.content;
  const raw = (typeof content === 'string' ? content : Object.values(content || {}).filter(v => typeof v === 'string').join('\n'))
    .replace(/=== AI 추출 핵심 경험 ===[\s\S]*?(?=\n=== |$)/g, '');
  const numbers = numberTokens(raw);
  return numbers.length ? new Set(numbers) : null;
}

// AI가 문장에 넣은 계산 숫자("약 2.6배", "290명 증가")는 원문에 없다. 두 자리 이상이거나 소수인 숫자가
// 원문에 없으면 그 문장을 슬라이드 재료에서 뺀다(한 자리 정수는 흔해서 확인하지 않는다).
const groundedNumber = (n, rawNumbers) => (!n.includes('.') && n.length < 2) || rawNumbers.has(n);
function dropUngrounded(text, rawNumbers) {
  if (!rawNumbers || !/\d/.test(text)) return text;
  return text.split(/(?<=[.!?。])\s+|\n+/).filter(sentence => numberTokens(sentence).every(n => groundedNumber(n, rawNumbers))).join(' ').trim();
}
// 제목·라벨·수치 칸과 이미 원문 대조를 거친 지표·외부 출처 리서치·이미지는 그대로 둔다
const KEEP_KEYS = /^(title|researchTitle|label|value|before|after|unit|name|url|caption|period|role|team|research|images|kpis|compare|funnel|metrics|marketerMetrics|pmMetrics)$/;
function groundTexts(node, rawNumbers, key = '') {
  if (!rawNumbers || KEEP_KEYS.test(key)) return node;
  if (typeof node === 'string') return dropUngrounded(node, rawNumbers);
  if (Array.isArray(node)) return node.map(item => groundTexts(item, rawNumbers));
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, groundTexts(v, rawNumbers, k)]));
  return node;
}

/**
 * Firestore 경험 문서(또는 같은 모양의 객체)에서 슬라이드 재료를 모은다.
 * 경험 문서: { title, jobCategory, structuredResult, caseStudy, keyExpImages, images, content }
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
  // 시각화용으로 AI가 따로 만든 수치(portfolioVisuals)는 정리된 문장에 같은 숫자가 있을 때만 쓴다(아래 trusted 검사).
  // 핵심 경험의 수치(metric·before·after)는 분석 단계에서 원본 대조를 거쳤다.
  // "명/일"처럼 단위만 있는 지표명은 라벨로 쓰지 않는다.
  const metricName = k => (k.metricLabel && !/^[\s%명건개회원점배일주월시간분초/·]+$/.test(k.metricLabel) ? k.metricLabel : k.title);
  const compare = arr(pv.compare).map(c => ({ label: str(c?.label), before: str(c?.before), after: str(c?.after), unit: str(c?.unit) }))
    .filter(c => c.label && c.before && c.after);
  keyExps.forEach(k => {
    if (k.before && k.after && !compare.some(c => c.after === k.after)) {
      compare.push({ label: metricName(k), before: k.before, after: k.after, unit: '', trusted: true });
    }
  });
  const kpis = [
    ...arr(pv.kpis).map(m => ({ label: firstOf(m?.label, m?.name), value: str(m?.value) })),
    ...keyExps.filter(k => k.metric).map(k => ({ label: metricName(k), value: k.metric, trusted: true })),
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

  const material = {
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
    marketing: collectMarketing(keyExps),
    funnel,
    compare,
    kpis,
    steps,
    research,
    images,
  };
  // 원문에 없는 계산 숫자가 든 문장은 빼고(원문이 있을 때), 정리된 문장 어디에도 없는 수치 카드는 버린다
  const rawNumbers = rawSourceNumbers(experience);
  const grounded = groundTexts(material, rawNumbers);
  const inRaw = value => !rawNumbers || numberTokens(value).every(n => groundedNumber(n, rawNumbers));
  const zones = zoneTexts(grounded);
  grounded.compare = compare.filter(c => c.trusted || (numberZone(zones, c.after) && inRaw(c.before) && inRaw(c.after)));
  grounded.kpis = kpis.filter(k => k.trusted || (numberZone(zones, k.value) && inRaw(k.value)));
  // 단계별 감소(퍼널)는 문제 근거로만 쓴다 — 원문에 있는 숫자이고, 결과 자리 문장에서 나온 숫자가 아닐 때만
  grounded.funnel = funnel.filter(() => funnel.every(s => inRaw(String(s.value)) && numberZone(zones, String(s.value)) !== 'result'));
  return grounded;
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

// 근거 카드 꼬리표 — 원문이 어떤 종류의 근거인지 두세 글자로. 파일명·경험 제목은 꼬리표로 쓰지 않는다.
function evidenceTag(text, type = '') {
  const t = `${str(type)} ${str(text)}`;
  if (/인터뷰|면담/.test(t)) return '인터뷰';
  if (/설문|응답/.test(t)) return '설문';
  if (/리뷰|후기|댓글|VOC|문의/.test(t)) return '고객 반응';
  if (/피드백/.test(t)) return '피드백';
  if (/데이터|그래프|로그|지표|\d\s*%|\d+\s*명\s*중/.test(t)) return '데이터';
  if (/관찰|현장/.test(t)) return '관찰';
  return '근거';
}

// 문제를 뒷받침하는 근거 — 사용자 자신의 문장(voiceRecord)은 근거가 아니고, 증거 묶음(evidenceBundle)은
// 성과를 뒷받침하는 자료가 섞여 있어(예: "가입 전환 6.2%") 문제 근거로 쓰지 않는다.
function problemVoices(m) {
  const voices = [];
  const add = (text, who) => { const s = slot(text, 70); if (s) voices.push({ text: s, who }); };
  for (const k of m.keyExps) {
    if (k.trace.problemEvidence) add(k.trace.problemEvidence, evidenceTag(k.trace.problemEvidence));
    if (k.jobData.painPoint) add(k.jobData.painPoint, '불편');
  }
  if (voices.length < 2) m.keyExps.filter(k => k.context).forEach(k => add(k.context, '상황'));
  if (voices.length < 2) {
    [[m.scope, '영향 범위'], [m.goal, '목표']]
      .filter(([text]) => text && text !== m.background)
      .forEach(([text, who]) => add(text, who));
  }
  return voices.filter((v, i, all) => all.findIndex(o => o.text.src === v.text.src) === i).slice(0, 3);
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
  return firstOf(lead.jobData.hypothesis, lead.trace.choice, lead.jobData.decision, m.goal);
}

/* ───────────────────────── 본문 숫자 → 그래프 ───────────────────────── */
// 정리한 문장 속 숫자를 그래프 재료로 쓴다. 숫자는 문장에 적힌 그대로만 쓰고(계산한 비율·증가율 없음),
// 단위가 다른 변화(1.4초 → 310ms 등)는 그리지 않는다. 문장이 놓인 자리(상황·실행·결과)에 맞는 장에 배치한다.
const NUM_RE = '\\d[\\d,]*(?:\\.\\d+)?';
const QTY_UNITS = '명|건|개|곳|회|번|권|편|장|팀|종';
const CHANGE_UNITS = `%p|%|배|점|원|만원|ms|초|분|시간|일|주|개월|${QTY_UNITS}`;
const RE_CHANGE = new RegExp(`([가-힣A-Za-z]+)?\\s*(${NUM_RE})\\s*(${CHANGE_UNITS})?\\s*(?:에서|→|->|⇒)\\s*(${NUM_RE})\\s*(${CHANGE_UNITS})`, 'g');
const RE_RATIO = new RegExp(`([가-힣A-Za-z]+)?\\s*(${NUM_RE})\\s*(명|건|개|곳|회|팀)\\s*중\\s*(${NUM_RE})\\s*(명|건|개|곳|회|팀)`, 'g');
const RE_SCORE = new RegExp(`([가-힣A-Za-z]+)?\\s*(${NUM_RE})\\s*\\/\\s*(5|10)(?![\\d.,])\\s*점?`, 'g');
const RE_PERCENT = new RegExp(`([가-힣A-Za-z]+)\\s*(${NUM_RE})\\s*%(?!p)`, 'g');
const RE_COUNT = new RegExp(`([가-힣A-Za-z]+)\\s*(${NUM_RE})\\s*(${QTY_UNITS})(?![가-힣]*\\s*중\\s*\\d)`, 'g');
const PARTICLE = /(에서|으로|이|가|은|는|을|를|의|에|로|과|와|도|만)$/;
const STOP_LABEL = /^(총|약|각|매|최대|최소|이상|이하|기존|평균|하루|매일|매주|단|및|등|모두|전체|중|후|전|무려|그중|하나|한|두|세|네|첫|지난|이번|다음|최종|직접)$/;
const toNumber = text => Number(String(text).replace(/,/g, ''));

// 동사·연결어(거쳐, 진행해, 만들고 …)로 끝나는 단어는 라벨이 아니다
const VERB_END = /(쳐|해|고|며|서|게|여|어|아|지|면|던|은|운|한|된|할|된|여서)$/;
function cleanLabel(word) {
  const w = str(word).replace(/[^가-힣A-Za-z]/g, '').replace(PARTICLE, '');
  return w.length >= 2 && w.length <= 10 && !STOP_LABEL.test(w) && !VERB_END.test(w) ? w : '';
}

function splitSentences(text) {
  return str(text).split(/(?<=[.!?。])\s+|\n+/).map(t => t.trim()).filter(t => t.length >= 6 && t.length <= 220);
}

// 문장 하나에서 그래프 후보를 뽑는다. 앞서 쓴 숫자 구간은 다시 쓰지 않는다.
function chartsFromSentence(text) {
  const used = [];
  const free = (m) => !used.some(([a, b]) => m.index < b && a < m.index + m[0].length);
  const take = (re, build) => {
    for (const m of text.matchAll(re)) {
      if (!free(m)) continue;
      const chart = build(m);
      if (chart) { used.push([m.index, m.index + m[0].length]); out.push(chart); }
    }
  };
  const out = [];
  take(RE_CHANGE, m => {
    const [, word, b, u1, a, u2] = m;
    if (u1 && u1 !== u2) return null;
    if (toNumber(b) === toNumber(a)) return null;
    return { type: 'change', label: cleanLabel(word) || '변화', before: `${b}${u2}`, after: `${a}${u2}`, b: toNumber(b), a: toNumber(a) };
  });
  take(RE_RATIO, m => {
    const [, word, total, u1, part, u2] = m;
    if (u1 !== u2 || toNumber(part) > toNumber(total) || !toNumber(total)) return null;
    return { type: 'ratio', label: cleanLabel(word) || '비율', part: `${part}${u2}`, total: `${total}${u1}`, p: toNumber(part), t: toNumber(total) };
  });
  take(RE_SCORE, m => {
    const [, word, value, max] = m;
    if (!(toNumber(value) > 0 && toNumber(value) <= toNumber(max))) return null;
    return { type: 'score', label: cleanLabel(word) || '점수', value, max, v: toNumber(value), mx: toNumber(max) };
  });
  take(RE_PERCENT, m => {
    const [, word, value] = m;
    const label = cleanLabel(word);
    if (!label || !(toNumber(value) > 0 && toNumber(value) <= 100)) return null;
    return { type: 'percent', label, value: `${value}%`, v: toNumber(value) };
  });
  take(RE_COUNT, m => {
    const [, word, value, unit] = m;
    const label = cleanLabel(word);
    if (!label || toNumber(value) < 2) return null;
    return { type: 'stat', label, value, unit };
  });
  return out;
}

// 그래프 아래 캡션 기본값 — 그래프의 데이터를 그대로 읽은 문장
function chartFallbackCaption(c) {
  if (c.type === 'change') return `${c.label} ${c.before} → ${c.after}`;
  if (c.type === 'ratio') return `${c.label} ${c.total} 중 ${c.part}`;
  if (c.type === 'score') return `${c.label} ${c.value}/${c.max}`;
  if (c.type === 'percent') return `${c.label} ${c.value}`;
  return '';
}

// 문장이 놓인 자리 — 상황(문제)·실행·결과
function zoneTexts(m) {
  return {
    problem: [m.background, m.sections.overview, m.scope, m.marketing?.problem, ...m.keyExps.flatMap(k => [k.context, k.trace.problemEvidence, k.jobData.painPoint])],
    process: [m.sections.task, m.sections.process, ...m.keyExps.flatMap(k => [k.action, k.trace.execution]), ...m.steps.map(s => s.desc), ...m.processCards.map(c => c.desc)],
    result: [m.sections.output, ...m.keyExps.map(k => k.result), ...m.highlights.map(h => h.text)],
  };
}

// 정리된 수치(핵심 지표·전후 비교)의 숫자가 원래 어느 자리 문장에 있었는지. 결과 자리에 있으면 결과로 본다.
function numberZone(zones, value) {
  const plain = text => str(text).replace(/(\d),(?=\d{3}(?!\d))/g, '$1'); // 3,400 = 3400
  const tokens = [...plain(value).matchAll(/\d+(?:\.\d+)?/g)].map(t => t[0]);
  if (!tokens.length) return null;
  const found = zone => zones[zone].some(text => tokens.every(t => new RegExp(`(?<![\\d.])${t.replace('.', '\\.')}(?![\\d]|\\.\\d)`).test(plain(text))));
  return ['result', 'problem', 'process'].find(found) || null;
}

function collectCharts(m) {
  const zones = zoneTexts(m);
  const seenSentence = new Set();
  const seenChart = new Set();
  const charts = [];
  for (const [zone, texts] of Object.entries(zones)) {
    for (const sentence of texts.flatMap(t => splitSentences(t))) {
      if (!/\d/.test(sentence) || seenSentence.has(sentence)) continue;
      seenSentence.add(sentence);
      for (const c of chartsFromSentence(sentence)) {
        const key = `${c.type}:${c.before || c.part || c.value}:${c.after || c.total || c.unit || ''}`;
        if (seenChart.has(key)) continue;
        seenChart.add(key);
        charts.push({ ...c, zone, caption: fitSlot([sentence], 36, 'caption', chartFallbackCaption(c)) });
      }
    }
  }
  return charts;
}

// 정리된 수치(전후 비교·핵심 지표)를 같은 그래프 형식으로
function chartFromCompare(c) {
  const b = parseNumber(c.before), a = parseNumber(c.after);
  if (b == null || a == null || b === a) return null;
  return { type: 'change', label: clampText(c.label, 14), before: clampText(c.before, 12), after: clampText(c.after, 12), b, a, caption: null };
}

function chartFromKpi(k) {
  const value = str(k.value);
  const pct = value.match(/^(\d[\d,]*(?:\.\d+)?)\s*%$/);
  if (pct && toNumber(pct[1]) > 0 && toNumber(pct[1]) <= 100) return { type: 'percent', label: clampText(k.label, 14), value, v: toNumber(pct[1]), caption: null };
  const score = value.match(/^(\d[\d,]*(?:\.\d+)?)\s*\/\s*(\d+)$/);
  if (score && toNumber(score[1]) <= toNumber(score[2])) return { type: 'score', label: clampText(k.label, 14), value: score[1], max: score[2], v: toNumber(score[1]), mx: toNumber(score[2]), caption: null };
  const stat = value.match(/^(\d[\d,]*(?:\.\d+)?)\s*([^\d\s]{0,4})$/);
  if (stat) return { type: 'stat', label: clampText(k.label, 14), value: stat[1], unit: stat[2], caption: null };
  return null;
}

// 만든 개수·진행 횟수 같은 실행량 — 결과 자리 문장에서 나온 게 아니면 성과로 보여주지 않는다.
const isActivityCount = c => c?.type === 'stat' && (/^(개|건|회|편|장|종|번)$/.test(c.unit) || /제작|발행|업로드|진행|분석|작성|검토|운영|기획/.test(c.label));

// 마케팅 지표 한 줄 → 그래프. 기준→실측이 같은 단위면 변화, 목표가 있으면 목표 대비, 아니면 단일 수치.
function chartFromMetric(r) {
  const label = clampText(r.name, 14);
  const unit = value => str(value).replace(/[\d.,\s+-]/g, '');
  const a = parseNumber(r.actual), b = parseNumber(r.baseline), t = parseNumber(r.target);
  if (a != null && b != null && a !== b && unit(r.baseline) === unit(r.actual)) {
    // 목표는 그래프의 점선과 아래 캡션("목표 25명")으로 보여준다
    const goal = t != null && t > 0 && unit(r.target) === unit(r.actual)
      ? { target: clampText(r.target, 12), t, caption: { text: `목표 ${clampText(r.target, 12)}`, src: '', max: 20, kind: 'caption' } }
      : { caption: null };
    return { type: 'change', label, before: clampText(r.baseline, 12), after: clampText(r.actual, 12), b, a, ...goal };
  }
  if (a != null && t != null && t > 0 && unit(r.target) === unit(r.actual)) {
    return { type: 'goal', label, target: clampText(r.target, 12), actual: clampText(r.actual, 12), t, a, caption: null };
  }
  return chartFromKpi({ label: r.name, value: r.actual });
}

const chartNumbers = c => [c.before, c.after, c.part, c.total, c.value, c.target, c.actual].filter(Boolean).map(v => String(v).replace(/[^\d.]/g, '')).join('|');
// 그래프가 말하는 한 가지 사실 — "1/5 → 4/5", "4/5점", "5명 중 4명"은 모두 4/5 라는 같은 사실이다
function mainFact(c) {
  const fraction = String(c.after || '').match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
  if (c.type === 'change') return fraction ? `${toNumber(fraction[1])}/${toNumber(fraction[2])}` : String(c.a);
  if (c.type === 'score') return `${c.v}/${c.mx}`;
  if (c.type === 'ratio') return `${c.p}/${c.t}`;
  if (c.type === 'percent') return String(c.v);
  if (c.type === 'goal') return String(c.a);
  return String(toNumber(c.value));
}

function buildSlides(m) {
  const slides = [];
  const lead = m.keyExps[0] || normalizeKeyExperience();
  const zones = zoneTexts(m);

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
  const mk = m.marketing;
  const problemText = firstOf(mk?.problem, lead.trace.problemJudgment, lead.jobData.painPoint, lead.context, m.background);
  const voices = problemVoices(m).filter(v => v.text.src !== hypothesisSource(lead, m));
  const textCharts = collectCharts(m);
  const usedNumbers = new Set();
  // 전후 비교(개선 결과)는 성과 장에서 보여준다. 문제 장에는 상황 문장 속 숫자나 단계별 감소(퍼널)만 쓴다.
  const problemFact = textCharts.find(c => c.zone === 'problem' && c.type !== 'stat');
  const chart = m.funnel.length >= 3
    ? { kind: 'funnel', data: m.funnel.slice(0, 5) }
    : problemFact ? { kind: 'fact', spec: problemFact } : null;
  if (chart?.kind === 'fact') usedNumbers.add(chartNumbers(problemFact));
  // 강조 카드 라벨은 원문의 성격대로 — 실제 가설이 아니면 '가설'이라 부르지 않는다.
  const [hypothesis, hypothesisLabel] = [
    // 목표 문장에 붙은 결과 메모("(목표 초과 달성: 31명)")는 문제 장에서 결과를 미리 말하므로 뗀다
    [lead.jobData.hypothesis, '가설'], [lead.trace.choice, '결정'], [lead.jobData.decision, '결정'], [str(m.goal).replace(/\s*\([^)]*(달성|초과|결과|성과|실제)[^)]*\)/g, ''), '목표'],
  ].map(([value, label]) => [str(value), label]).find(([value]) => value) || ['', ''];
  // 근거 목록은 위 문장(리드·상황 카드)과 다른 근거가 2개 이상일 때만 쓰고, 아니면 상황 문장 카드 하나로 보여준다.
  // 그래프가 있으면 [그래프 | 근거 목록 | 가설], 없으면 [상황 카드 | 근거 목록 | 가설] — 넓은 빈 카드를 만들지 않는다.
  const leadSource = firstOf(m.background, lead.context, problemText);
  const statementSource = firstOf(lead.context, m.background, problemText);
  const distinctVoices = voices.filter(v => ![leadSource, statementSource].some(s => noPeriod(v.text.src) === noPeriod(s)));
  const briefOnly = distinctVoices.length < 2;
  if (problemText) {
    const heard = distinctVoices.some(v => ['인터뷰', '설문', '고객 반응'].includes(v.who));
    slides.push({
      type: 'problem',
      // 근거가 하나뿐이면 따로 카드를 만들지 않고 상황 문장에 이어 붙인다(그래프가 있으면 그래프가 근거라 붙이지 않는다)
      statement: briefOnly ? slot([statementSource, ...(chart ? [] : distinctVoices.map(v => v.text.src))].join(' '), 150) : chart ? null : slot(statementSource, 110),
      title: fitSlot([problemText, lead.jobData.painPoint], 24, 'title', heard ? (chart ? '데이터와 고객 반응으로 본 문제' : '고객 반응으로 확인한 문제') : chart ? '데이터로 찾은 문제' : '직접 확인한 문제'),
      lead: !briefOnly && chart ? slot(leadSource, 90) : null,
      chart: chart && (chart.kind === 'fact'
        ? { kind: 'fact', spec: { ...chart.spec, caption: null }, caption: chart.spec.caption }
        : { ...chart, caption: fitSlot([problemText, lead.jobData.painPoint], 28, 'caption', chartCaption(chart)) }),
      voices: briefOnly ? [] : distinctVoices,
      hypothesis: hypothesis ? slot(hypothesis, 48, 'body') : null,
      hypothesisLabel,
    });
  }

  // 2-1) 마케팅 전략 — 누구에게(타깃·근거) · 어디서(채널·선택 이유) · 무엇을(메시지)
  if (mk?.target && (mk.channels.length || mk.channelNote || mk.message)) {
    slides.push({
      type: 'strategy',
      title: fitSlot([], 30, 'title', '누구에게, 어디서, 무엇을'),
      target: { name: fitSlot([mk.target], 34, 'title'), why: mk.insight ? slot(mk.insight, 96) : null },
      channels: mk.channels.slice(0, 3).map(c => ({ name: fitSlot([c.name], 16, 'title'), why: c.why ? slot(c.why, 60) : null })),
      channelNote: !mk.channels.length && mk.channelNote ? slot(mk.channelNote, 120) : null,
      message: mk.message ? {
        // 실제 문안(카피)은 고치지 않고 그대로 싣는다(AI 줄이기 대상에서 제외)
        text: mk.messageIsCopy ? { text: clampText(mk.message, 64), src: mk.message, max: 64, kind: 'quote' } : slot(mk.message, 72),
        isCopy: mk.messageIsCopy,
        why: mk.messageWhy ? slot(mk.messageWhy, 80) : null,
      } : null,
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
  // 마케터는 실제 테스트·개선 기록을 먼저 쓴다(가설 → 테스트 → 결과 → 결정)
  const [testSteps, tuneSteps] = mk?.process || [];
  const steps = [testSteps || [], tuneSteps || [], m.steps, traceSteps, m.processCards, sectionFlow].find(list => list.length >= 3) || [];
  // 실행 규모 — 실행 문장 속 개수(설문 84명, 인터뷰 12명 …)를 숫자 띠로. 목표·결과 숫자는 실행 규모가 아니다.
  const processStats = textCharts.filter(c => c.zone === 'process' && c.type === 'stat')
    .filter(c => numberZone(zones, c.value) !== 'result' && !/목표|기준|결과|성과|달성|조회|도달|팔로워|전환|매출|방문|클릭/.test(c.label))
    .filter((c, i, all) => all.findIndex(o => o.label === c.label) === i).slice(0, 4);
  const stats = processStats.length >= 2 ? processStats.map(c => ({ label: c.label, value: c.value, unit: c.unit })) : [];
  stats.forEach(c => usedNumbers.add(c.value));
  if (pairs.length >= 2) {
    slides.push({
      type: 'process',
      variant: 'pairs',
      title: fitSlot([m.process], 36, 'title', '무엇을 했고, 무엇이 바뀌었나'),
      stats,
      pairs: pairs.slice(0, 3).map(k => ({
        action: { title: fitSlot([k.title, k.action], 18), desc: slot(k.action, 64) },
        outcome: { title: fitSlot([k.metric && `${k.metricLabel ? `${k.metricLabel} ` : ''}${k.metric}`, k.metric, k.result], 20), desc: slot(k.result || k.metric, 64) },
      })),
    });
  } else if (steps.length < 3 && stats.length >= 2 && firstOf(lead.action, m.sections.process, m.sections.task)) {
    // 단계를 세울 재료는 없지만 실행 규모 숫자가 있는 경험 — 한 일 + 규모 숫자
    slides.push({
      type: 'process',
      variant: 'scale',
      title: fitSlot([m.process], 36, 'title', '실행 규모'),
      statement: slot(firstOf(lead.action, m.sections.process, m.sections.task), 120),
      stats,
    });
  } else if (steps.length >= 3) {
    slides.push({
      type: 'process',
      // 피라미드는 원래 '단계' 데이터일 때만 — 섹션 흐름처럼 위계가 없는 순서는 가로 흐름으로
      variant: steps === m.steps && steps.length <= 4 ? 'pyramid' : 'flow',
      title: fitSlot([m.process], 36, 'title', steps === testSteps ? '가설을 세우고 검증한 과정' : steps === tuneSteps ? '반응을 보고 바꾼 것' : '문제를 푼 과정'),
      stats,
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

  // 6) 성과 — 목표·기준과 비교한 실측 → 정리된 수치 → 결과 문장 속 숫자 순으로 그래프 카드를 만들고, 모자라면 결과 문장 카드로 채운다.
  // 상황·실행 문장에서 나온 숫자(문제 통계, 만든 개수)는 성과가 아니므로 싣지 않는다.
  const resultCharts = [];
  for (const c of [
    ...(mk?.metrics || []).map(chartFromMetric),
    ...m.compare.filter(c => !['problem', 'process'].includes(numberZone(zones, c.after))).map(chartFromCompare),
    ...m.kpis.filter(k => !['problem', 'process'].includes(numberZone(zones, k.value))).map(chartFromKpi)
      .filter(c => !isActivityCount(c) || numberZone(zones, c.value) === 'result'),
    ...textCharts.filter(c => c.zone === 'result' && !isActivityCount(c)),
  ]) {
    if (!c) continue;
    // 이미 다른 그래프에 나온 숫자·사실을 다시 그리지 않는다(예: CTR 0.8%→2.1% 다음의 CTR 2.1%, 4/5 → 5명 중 4명)
    const shown = new Set(resultCharts.flatMap(o => chartNumbers(o).split('|')));
    if (usedNumbers.has(chartNumbers(c)) || chartNumbers(c).split('|').every(n => shown.has(n))
      || resultCharts.some(o => mainFact(o) === mainFact(c))) continue;
    resultCharts.push(c);
    if (resultCharts.length === 3) break;
  }
  const charted = new Set(resultCharts.flatMap(c => chartNumbers(c).split('|')));
  const repeatsChart = text => { const nums = numberTokens(text); return nums.length > 0 && nums.every(n => charted.has(n)); };
  const notes = [
    ...m.highlights.map(h => ({ label: h.label, text: h.text })),
    { label: '결과', text: firstOf(lead.result, m.sections.output) },
  ].filter((n, i, all) => n.text && !repeatsChart(n.text) && all.findIndex(o => o.text === n.text) === i).slice(0, Math.max(0, 3 - resultCharts.length));
  if (resultCharts.length || notes.length >= 2) {
    slides.push({
      type: 'result',
      title: fitSlot([lead.result, m.summary, m.sections.output], 30, 'title', resultCharts.length ? '숫자로 본 결과' : '정리한 결과'),
      charts: resultCharts.map(c => ({ ...c, zone: undefined })),
      notes: notes.map((n, i) => ({ label: fitSlot([n.label], 10, 'title', String(i + 1).padStart(2, '0')), text: slot(n.text, 90) })),
    });
  }

  // 7) 마무리 — 매번 같은 '배운 점' 띠 대신, 이 경험에만 있는 내용이 있을 때만 만든다.
  //    판단이 바뀐 기록이 있으면 [처음 판단 → 바뀐 판단 → 지금의 기준], 다음 실험 계획이 있으면 [다음에 검증할 것 · 해석의 한계].
  const sameMeaning = (a, b) => {
    const grams = t => new Set([...noPeriod(t).replace(/\s+/g, '')].map((ch, i, all) => ch + (all[i + 1] || '')));
    const x = grams(a), y = grams(b);
    return x.size > 0 && [...x].filter(g => y.has(g)).length / Math.min(x.size, y.size) >= 0.6;
  };
  const shift = [
    { label: '처음 판단', text: sameMeaning(lead.review.misjudgment, lead.trace.changedJudgment) ? '' : firstOf(lead.review.misjudgment) },
    { label: '바뀐 판단', text: firstOf(lead.trace.changedJudgment) },
    { label: '지금의 기준', text: firstOf(lead.trace.newPrinciple) },
  ].filter(s => s.text);
  const next = [
    { label: '다음에 검증할 것', text: firstOf(mk?.next, lead.jobData.nextExperiment, lead.review.nextTime) },
    { label: '해석의 한계', text: firstOf(mk?.limit, lead.review.limitation) },
  ].filter(s => s.text);
  const closing = lead.trace.changedJudgment && shift.length >= 2 ? { variant: 'shift', items: shift }
    : next[0]?.label === '다음에 검증할 것' ? { variant: 'next', items: next } : null;
  if (closing) {
    slides.push({
      type: 'closing',
      variant: closing.variant,
      title: fitSlot([], 30, 'title', closing.variant === 'shift' ? '이 경험으로 바뀐 판단' : '다음에 확인할 것'),
      items: closing.items.map(s => ({ label: s.label, text: slot(s.text, 90) })),
    });
  }

  return dedupeSlides(slides).map((s, i) => ({ id: `${s.type}-${i}`, ...s }));
}

// 같은 문장이 여러 칸에 나오지 않게 한다. 앞 장(앞 칸)을 남기고, 뒤의 중복은
// 카드형 항목이면 빼고 설명형 칸이면 비운다. 제목·라벨은 짧아서 겹쳐도 둔다.
const SKIP_DEDUPE = /^(title|label|tag|hypothesis|name)$/;
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
      if (!slot.text) continue;
      if (SKIP_DEDUPE.test(field.at(-1))) { seen.add(norm(slot.text)); continue; }
      // 원문이 달라도 잘라낸 문장이 같으면 같은 문장으로 본다
      const keys = [norm(slot.src), norm(slot.text)].filter(Boolean);
      if (!keys.some(k => seen.has(k))) { keys.forEach(k => seen.add(k)); continue; }
      drop.push(field);
    }
    for (const field of drop.reverse()) {
      const [head, index] = field;
      if (['voices', 'notes', 'items'].includes(head) || (head === 'steps' && field[2] === 'desc')) slide[head][index] = null;
      else if (head === 'toBe' && field[1] === 'points') slide.toBe.points[field[2]] = null;
      else {
        let node = slide;
        field.slice(0, -1).forEach(k => { node = node?.[k]; });
        if (node) node[field.at(-1)] = null;
      }
    }
    if (slide.voices) slide.voices = slide.voices.filter(Boolean);
    if (slide.notes) slide.notes = slide.notes.filter(Boolean);
    if (slide.items) slide.items = slide.items.filter(Boolean);
    if (slide.steps) slide.steps = slide.steps.filter(Boolean);
    if (slide.toBe?.points) slide.toBe.points = slide.toBe.points.filter(Boolean);
  }
  return slides.filter(s => {
    if (s.type === 'problem') return s.chart || s.voices?.length || s.statement?.text || s.hypothesis?.text;
    if (s.type === 'result') return s.charts?.length || s.compares?.length || s.kpis?.length || s.notes?.length || s.learning?.text;
    if (s.type === 'closing') return s.items?.length;
    return true;
  });
}

// 덱 구성 규칙이 바뀌면 올린다 — 저장된 덱이 경험 내용은 같아도 새 규칙으로 한 번 다시 만들어지도록.
// 2: 본문 숫자 그래프(문제·실행 규모·성과 대시보드)
// 3: 근거 목록형 문제 장, 마케팅 전략 장, 자리별 성과 수치, 내용이 있을 때만 만드는 마무리 장
const DECK_BUILDER_VERSION = 3;

export function deckSourceHash(material) {
  return hashString(`${DECK_BUILDER_VERSION}:${JSON.stringify(material)}`);
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
