/**
 * onePager — 60초 안에 "이 사람 부를지" 정하는 한 장.
 *
 * 배경: 산출물이 전부 "읽어야 아는" 형태였다. 채용담당자가 실제로 쓰는 시간은 1분 미만이고,
 * 그 층에 놓을 산출물이 없었다. 노션 11종·웹 4종은 전부 상세 문서다.
 *
 * 구성 원칙
 * 1) 요구 역량 순서를 따른다 — 기업 분석이 있으면 그 순서, 없으면 근거 강한 순.
 * 2) 한 역량당 한 줄. 그 줄에는 반드시 "무엇으로 확인되는지"가 붙는다.
 * 3) 없는 것을 채우지 않는다. 줄 수가 적으면 적은 채로 둔다.
 *
 * 이력서 bullet도 같은 재료를 쓴다 — marketer 전용이던 `resumeBullets` 공식
 * ([강한 동사]+[대상]+[방법]+[성과])을 전 직군으로 넓힌 것.
 */
import { buildJdEvidenceMap } from './jdEvidenceMap';

const txt = (v) => String(v ?? '').trim();
const PLACEHOLDER = /^\s*\[(작성|검증|확인)\s*필요\]/;
const ok = (v) => {
  const t = txt(v);
  return t && !PLACEHOLDER.test(t) ? t : '';
};
const clip = (v, n) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);
const firstSentence = (v) => {
  const t = ok(v);
  if (!t) return '';
  const m = t.match(/^[^.!?\n]{10,140}[.!?]?/);
  return m ? m[0].trim() : clip(t, 140);
};

const expsOf = (list) => (Array.isArray(list) ? list : []);
const keyExpsOf = (exp) => expsOf(exp?.structuredResult?.keyExperiences);

/* ── 이력서 bullet ────────────────────────────────────────────────
   판단·근거에서 만든다. "무엇을 했다"가 아니라 "무엇을 어떻게 해서 무엇이 달라졌다".
   수치가 없으면 수치 없이 쓴다 — 억지로 숫자를 붙이면 AI 작성물로 읽힌다. */
export function buildResumeBullets(experiences = []) {
  const rows = [];
  expsOf(experiences).forEach((exp) => {
    const from = ok(exp?.title);
    keyExpsOf(exp).forEach((ke) => {
      const trace = ke?.decisionTrace || {};
      const action = ok(trace.execution) || ok(trace.choice) || firstSentence(ke?.action);
      if (!action) return;
      const outcome = ok(ke?.metric) && ok(ke?.metricLabel)
        ? `${ke.metricLabel} ${ke.metric}`
        : firstSentence(ke?.result);
      const evidence = ok(trace.outcomeEvidence);
      rows.push({
        from,
        title: ok(ke?.title),
        // 한 줄: 실행 → 결과. 결과가 없으면 실행만.
        text: clip([firstSentence(action), outcome].filter(Boolean).join(' → '), 180),
        // 확인 근거가 있으면 "무엇으로 확인했는지"를 같이 들고 다닌다
        evidence: evidence ? clip(evidence, 120) : '',
        hasMetric: !!ok(ke?.metric),
        keywords: expsOf(ke?.keywords).map(ok).filter(Boolean),
      });
    });
  });
  return rows;
}

/* ── 한 장 요약 ───────────────────────────────────────────────────
   jobAnalysis 가 있으면 요구 역량 상위 5개 순서로, 없으면 근거 강한 경험 순으로. */
export function buildOnePager({ profile = {}, experiences = [], jobAnalysis = null } = {}) {
  const bullets = buildResumeBullets(experiences);
  const map = buildJdEvidenceMap({ jobAnalysis, experiences });

  let lines;
  if (map.hasJobAnalysis) {
    // 요구 역량 순서 그대로 — 근거 있는 것만. 공백은 채우지 않고 아래 gaps 로 따로 알린다.
    lines = map.rows
      .filter(row => row.matched.length)
      .slice(0, 5)
      .map(row => ({
        requirement: row.requirement,
        kind: row.kind,
        proof: clip(row.matched[0].text, 150),
        source: row.matched[0].source,
        confirmed: row.status === '근거 있음',
      }));
  } else {
    lines = bullets
      // 확인 근거가 붙은 것 → 수치가 있는 것 → 나머지
      .sort((a, b) => (Number(!!b.evidence) - Number(!!a.evidence)) || (Number(b.hasMetric) - Number(a.hasMetric)))
      .slice(0, 5)
      .map(b => ({
        requirement: b.title || b.from,
        kind: '경험',
        proof: b.text,
        source: b.evidence ? '결과 확인 근거 있음' : '',
        confirmed: !!b.evidence,
      }));
  }

  const identity = expsOf(experiences)
    .map(exp => ok(exp?.structuredResult?.identitySignal?.sentence))
    .find(Boolean) || '';

  return {
    name: ok(profile.userName) || ok(profile.name),
    headline: ok(profile.headline) || identity,
    target: jobAnalysis ? [ok(jobAnalysis.company), ok(jobAnalysis.position)].filter(Boolean).join(' · ') : '',
    lines,
    // 요구 역량 중 근거가 없는 것 — 지원자에게 보여주는 정보(산출물에 싣지 않는다)
    gaps: map.hasJobAnalysis ? map.rows.filter(r => r.status === '공백').map(r => r.requirement).slice(0, 5) : [],
    summary: map.summary,
  };
}
