/**
 * 간략 보기(caseStudy) ↔ 자세히 보기(structuredResult) 공통 필드 동기화.
 *
 * 두 보기는 서로 다른 필드에 저장된다:
 *  - 간략 보기: experiences/{id}.caseStudy   (제목·요약·역할·핵심경험 + 자유 본문/사진 등 간략 전용)
 *  - 자세히 보기: experiences/{id}.structuredResult (7섹션·시장리서치·근거라벨 등 자세히 전용 포함)
 *
 * 한쪽에서 수정·저장할 때, 두 표현이 "공유"하는 핵심 필드만 반대쪽에 써준다(write-through).
 * 각 보기 전용 필드는 보존하므로 손실이 없다.
 *
 * 공유 필드: 제목 / 요약 / 역할·기간·팀 / 핵심경험(제목·결과수치·문제·행동·결과·배움)
 */

const isDraft = (v) => {
  const t = String(v || '').trim();
  if (!t) return true;
  if (t.startsWith('[작성 필요]') || t.startsWith('[검증 필요]')) return true;
  if (/\(예시\)/.test(t)) return true;
  if (/【[^】]*】/.test(t)) return true;
  if (/(공식에 맞춰|작성하세요|반영하세요|포함하세요|서술하세요|남기세요|적어주세요)/.test(t)) return true;
  return false;
};
const clean = (v) => (isDraft(v) ? '' : String(v).replace(/\*\*/g, '').replace(/^#+\s/gm, '').trim());

/**
 * 간략 보기(caseStudy)의 공통 필드를 자세히 보기(structuredResult)에 반영.
 * structuredResult 전용 필드(7섹션·marketResearch·evidence 등)와 핵심경험의 비공유 필드
 * (beforeMetric·metricLabel·keywords·chartType 등)는 그대로 보존한다.
 */
export function mergeCaseStudyIntoStructured(structuredResult, caseStudy) {
  const sr = structuredResult || {};
  if (!caseStudy) return sr;
  const prevKE = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
  const keyExperiences = (Array.isArray(caseStudy.keyExps) ? caseStudy.keyExps : []).map((k, i) => ({
    ...(prevKE[i] || {}),
    title: k.title || '',
    // 간략 보기의 'metric'은 결과 수치 → 자세히 보기의 afterMetric에 대응 (deriveCaseStudy와 동일 규칙)
    afterMetric: k.metric || '',
    metric: k.metric || prevKE[i]?.metric || '',
    context: k.problem || '',
    action: k.action || '',
    result: k.result || '',
    learning: k.learning || '',
  }));
  return {
    ...sr,
    intro: caseStudy.summary || sr.intro || '',
    projectOverview: {
      ...(sr.projectOverview || {}),
      summary: caseStudy.summary || sr.projectOverview?.summary || '',
      role: caseStudy.meta?.role ?? sr.projectOverview?.role ?? '',
      duration: caseStudy.meta?.duration ?? sr.projectOverview?.duration ?? '',
      team: caseStudy.meta?.team ?? sr.projectOverview?.team ?? '',
    },
    keyExperiences,
  };
}

/**
 * 자세히 보기(structuredResult)의 공통 필드를 간략 보기(caseStudy)에 반영.
 * caseStudy 전용 필드(body 자유 본문, 핵심경험 사진 등)는 보존한다.
 * 저장된 caseStudy가 없으면 그대로 반환한다(다음 로드 때 structuredResult에서 새로 파생됨).
 */
export function mergeStructuredIntoCaseStudy(caseStudy, structuredResult, title) {
  if (!caseStudy) return caseStudy;
  const sr = structuredResult || {};
  const ov = sr.projectOverview || {};
  const ke = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
  return {
    ...caseStudy,
    title: clean(title) || caseStudy.title || '',
    summary: clean(ov.summary) || clean(sr.intro) || caseStudy.summary || '',
    meta: {
      ...(caseStudy.meta || {}),
      role: clean(ov.role),
      duration: clean(ov.duration),
      team: clean(ov.team),
    },
    keyExps: ke.map((k, i) => ({
      ...(caseStudy.keyExps?.[i] || { id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`, images: [] }),
      title: clean(k.title),
      metric: clean(k.afterMetric) || clean(k.metric),
      problem: clean(k.context || k.situation),
      action: clean(k.action),
      result: clean(k.result),
      learning: clean(k.learning),
    })),
  };
}
