/**
 * interviewPrep — 정리된 경험을 면접 대비 산출물로 바꾼다.
 *
 * 배경: decisionTrace(대안·기준·바뀐 판단) · honestReview(막힌 지점·한계) · evidenceBundle 은
 * 사실 면접 답변의 원재료인데, 산출물이 전부 서류용(노션·웹·PPT·PDF·이력서)이라
 * 가장 값비싼 데이터가 면접 구간에서 쓰이지 않고 있었다.
 *
 * ⚠️ 이 결과물은 지원자 본인용이다. "파고들면 무너지는 지점"은 채용담당자에게 보내는
 *    산출물(coreExperienceSections)에 절대 포함하지 않는다.
 *
 * AI를 부르지 않는다. 이미 저장된 문장만 골라 배치하고, 없는 것은 "빈칸"으로 표시한다.
 */

const txt = (v) => String(v ?? '').trim();
const PLACEHOLDER = /^\s*\[(작성|검증|확인)\s*필요\]/;
const ok = (v) => {
  const t = txt(v);
  return t && !PLACEHOLDER.test(t) ? t : '';
};
const clip = (v, n) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);

const listOf = (value, pick) => (Array.isArray(value) ? value : [])
  .map(item => (typeof item === 'string' ? ok(item) : ok(pick(item || {}))))
  .filter(Boolean);

/* ── ① 예상 질문 ↔ 내 근거 ────────────────────────────────────────
   질문은 고정 목록이 아니라 "그 경험에 실제로 있는 것"에서 나온다.
   basis 가 비면 그 자체가 준비 안 된 지점이므로 그대로 노출한다. */

function questionsForKeyExp(ke, index) {
  const trace = ke?.decisionTrace || {};
  const review = ke?.honestReview || {};
  const label = ok(ke?.title) || `핵심 경험 ${index + 1}`;
  const alternatives = listOf(trace.alternatives, o => [ok(o.option), ok(o.reasonNotChosen) || ok(o.cons)].filter(Boolean).join(' — '));
  const criteria = listOf(trace.decisionCriteria, o => [ok(o.criterion), ok(o.why)].filter(Boolean).join(' — '));

  const rows = [
    {
      q: '이 선택 말고 어떤 안을 검토했고, 왜 그걸 버렸나요?',
      basis: alternatives.join('\n'),
      hint: '대안을 말하지 못하면 "그냥 그렇게 했다"로 들립니다.',
    },
    {
      q: '결정을 가른 기준은 무엇이었나요?',
      basis: criteria.join('\n') || ok(trace.choice),
      hint: '일정·비용·사용자 가치·리스크 중 무엇을 우선했는지.',
    },
    {
      q: '팀이 한 일과 본인이 직접 한 일을 나눠 말해 주세요.',
      basis: ok(trace.execution),
      hint: '경력 검증에서 가장 자주 무너지는 지점.',
    },
    {
      q: ok(ke?.metric) ? `${ok(ke?.metricLabel) || '이 수치'}(${ok(ke.metric)})는 어떻게 측정했고 비교군은 무엇이었나요?` : '결과를 무엇으로 확인했나요?',
      basis: ok(trace.outcomeEvidence) || ok(ke?.result),
      hint: '분모·기간·비교군이 없으면 인과 주장으로 읽히지 않습니다.',
    },
    {
      q: '가장 막혔던 지점은 어디였나요?',
      basis: ok(review.struggle),
      hint: '면접에서 가장 자주 묻는 질문.',
    },
    {
      q: '예상과 달랐던 점, 그래서 바뀐 판단은 무엇인가요?',
      basis: ok(trace.changedJudgment) || ok(review.misjudgment) || ok(trace.newPrinciple),
      hint: '판단이 바뀐 기록이 있으면 성장 서술이 구체적으로 들립니다.',
    },
    {
      q: '검증하지 못한 채 남긴 것은 무엇인가요?',
      basis: ok(review.limitation),
      hint: '한계를 먼저 말하면 나머지 주장의 신뢰가 올라갑니다.',
    },
  ];

  return rows.map(row => ({ ...row, from: label, ready: !!row.basis }));
}

/* ── ② 파고들면 무너지는 지점 ───────────────────────────────────── */

const WEAK_STATUS = new Set(['추가 필요', '확인 필요']);

function fragileForKeyExp(ke, index) {
  const trace = ke?.decisionTrace || {};
  const label = ok(ke?.title) || `핵심 경험 ${index + 1}`;
  const rows = [];
  const push = (claim, reason, fix) => rows.push({ from: label, claim, reason, fix });

  // 수치는 있는데 그 수치를 확인한 자료가 없다
  if (ok(ke?.metric) && !ok(trace.outcomeEvidence)) {
    push(
      `${ok(ke?.metricLabel) || '성과 수치'} ${ok(ke.metric)}`,
      '수치를 확인한 자료(로그·리포트·대시보드)가 연결되지 않았습니다.',
      '측정 화면이나 리포트를 증거 번들에 추가하거나, 수치 대신 정성 근거로 바꾸세요.',
    );
  }

  // 결론만 있고 비교한 대안이 없다
  if (ok(trace.choice) && !listOf(trace.alternatives, o => o.option).length) {
    push(ok(trace.choice), '비교한 대안이 비어 있어 "판단"이 아니라 "지시 수행"으로 읽힙니다.', '당시 검토했다가 버린 안 하나만 적어도 서술이 달라집니다.');
  }

  // 본인 실행 범위가 비어 있다
  if (!ok(trace.execution)) {
    push(label, '본인이 직접 실행한 범위가 비어 있어 팀 성과와 구분되지 않습니다.', '내가 만든/결정한 것과 남이 한 것을 한 문장으로 나누세요.');
  }

  // 증거 번들에서 아직 확보되지 않은 항목
  (Array.isArray(ke?.evidenceBundle) ? ke.evidenceBundle : []).forEach((ev) => {
    if (WEAK_STATUS.has(txt(ev?.status))) {
      push(
        ok(ev?.claim) || ok(ev?.whatItProves) || label,
        `증거 상태가 "${txt(ev.status)}"입니다.`,
        ok(ev?.sourceRef) ? `${ok(ev.sourceRef)}를 확보하거나 주장 범위를 줄이세요.` : '자료를 확보하거나 주장 범위를 줄이세요.',
      );
    }
  });

  return rows;
}

/** 근거 장부에서 C·D 등급 주장 — 원본 위치가 불완전하거나 회상뿐인 것 */
function fragileFromLedger(sr) {
  return (sr?.artifactAnalysis?.evidenceLedger || [])
    .filter(row => ['C', 'D'].includes(txt(row?.proofLevel)))
    .map(row => ({
      from: '근거 장부',
      claim: ok(row?.claim),
      reason: txt(row.proofLevel) === 'D'
        ? '연결된 자료 없이 회상만 있는 주장입니다 (D등급).'
        : '날짜·작성자·원본 위치가 불완전합니다 (C등급).',
      fix: ok(row?.gap) || '원본 파일이나 링크를 다시 연결하세요.',
    }))
    .filter(r => r.claim);
}

/* ── ③ 구두 버전 ───────────────────────────────────────────────── */

function buildPitches(sr, keyExps) {
  const identity = ok(sr?.identitySignal?.sentence)
    || ok(keyExps.find(ke => ok(ke?.identitySignal?.sentence))?.identitySignal?.sentence);
  const top = keyExps.find(ke => ok(ke?.metric)) || keyExps[0] || {};
  const headline = [ok(top.title), ok(top.metricLabel) && ok(top.metric) ? `${ok(top.metricLabel)} ${ok(top.metric)}` : '']
    .filter(Boolean).join(' — ');

  const pitch30 = [identity, headline].filter(Boolean).join(' ');
  const pitch120 = [
    ok(top.context),
    ok(top.action),
    ok(top.result),
    ok(top.learning),
  ].filter(Boolean).join(' ');

  return {
    pitch30: pitch30 ? clip(pitch30, 220) : '',
    pitch120: pitch120 ? clip(pitch120, 700) : '',
  };
}

/* ── 진입점 ────────────────────────────────────────────────────── */

/**
 * @param exp 경험 문서 ({ title, structuredResult, ... })
 * @returns { questions, fragile, pitch30, pitch120, readiness }
 */
export function buildInterviewPrep(exp) {
  const sr = exp?.structuredResult || {};
  const keyExps = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];

  const questions = keyExps.flatMap((ke, i) => questionsForKeyExp(ke, i));
  const fragile = [
    ...keyExps.flatMap((ke, i) => fragileForKeyExp(ke, i)),
    ...fragileFromLedger(sr),
  ];

  const ready = questions.filter(q => q.ready).length;

  return {
    ...buildPitches(sr, keyExps),
    questions,
    fragile,
    readiness: {
      ready,
      total: questions.length,
      percent: questions.length ? Math.round((ready / questions.length) * 100) : 0,
    },
  };
}
