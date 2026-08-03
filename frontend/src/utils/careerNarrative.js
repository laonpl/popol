/**
 * careerNarrative — 정리된 경험들을 가로질러 "이 사람은 어떤 사람인가"를 뽑아낸다.
 *
 * 경험 하나로는 취향이지만 여러 경험에서 반복되면 패턴이다.
 * 여기서 만드는 값들은 경험이 늘어날수록 근거가 두꺼워지도록 설계했다.
 * (identitySignal / decisionTrace / honestReview / evidenceBundle / 태그는
 *  경험 정리 파이프라인이 이미 채우고 있는 필드다.)
 */

const txt = (v) => String(v ?? '').trim();
const ok = (v) => {
  const t = txt(v);
  return t && !/^\[(작성|검증|확인)\s*필요\]/.test(t) ? t : '';
};
const srOf = (exp) => exp?.structuredResult || {};
const keyExpsOf = (exp) => (Array.isArray(srOf(exp).keyExperiences) ? srOf(exp).keyExperiences : []);
const titleOf = (exp) => txt(exp?.title) || '제목 없음';

/** 경험 전체에서 keyExperiences를 평탄화 — 출처(경험 제목)를 함께 들고 다닌다 */
function flatKeyExps(experiences) {
  return experiences.flatMap(exp => keyExpsOf(exp).map(ke => ({ ke, expTitle: titleOf(exp), exp })));
}

/** 빈도 집계 후 많은 순 정렬 */
function tally(items) {
  const map = new Map();
  items.filter(Boolean).forEach(k => map.set(k, (map.get(k) || 0) + 1));
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

const yearMonth = (value) => {
  if (!value) return null;
  const d = value?.toDate?.() || (value?.seconds ? new Date(value.seconds * 1000) : new Date(value));
  return Number.isNaN(d?.getTime?.()) ? null : d;
};

/* ① 나를 보여주는 한 문장 — 여러 경험에서 반복되면 "검증됨"으로 승격 */
export function buildIdentitySentences(experiences) {
  const rows = experiences
    .map(exp => ({ sentence: ok(srOf(exp).identitySignal?.sentence), pattern: ok(srOf(exp).identitySignal?.pattern), from: titleOf(exp) }))
    .filter(r => r.sentence || r.pattern);
  const patterns = tally(rows.map(r => r.pattern).filter(Boolean));
  return {
    sentences: rows.filter(r => r.sentence).slice(0, 5),
    // 같은 행동 패턴이 3회 이상이면 확정, 2회면 관찰 중, 1회면 가설
    patterns: patterns.map(p => ({
      ...p,
      status: p.count >= 3 ? '검증됨' : p.count === 2 ? '관찰 중' : '가설',
    })).slice(0, 6),
    total: rows.length,
  };
}

/* ② 판단 원칙 — decisionTrace.newPrinciple 누적 */
export function buildPrinciples(experiences) {
  return flatKeyExps(experiences)
    .map(({ ke, expTitle }) => ({ text: ok(ke?.decisionTrace?.newPrinciple), from: expTitle }))
    .filter(r => r.text)
    .slice(0, 10);
}

/* ③ 생각이 바뀐 순간 — 오판 → 수정 */
export function buildTurningPoints(experiences) {
  return flatKeyExps(experiences)
    .map(({ ke, expTitle }) => ({
      before: ok(ke?.honestReview?.misjudgment) || ok(ke?.decisionTrace?.changedJudgment),
      after: ok(ke?.decisionTrace?.newPrinciple) || ok(ke?.honestReview?.nextTime),
      from: expTitle,
    }))
    .filter(r => r.before)
    .slice(0, 8);
}

/* ④ 역량 성장 곡선 — 태그가 처음 등장한 시점 순으로 누적 */
export function buildCompetencyGrowth(experiences) {
  const seen = new Map();
  experiences
    .map(exp => ({ exp, at: yearMonth(exp?.createdAt) }))
    .filter(r => r.at)
    .sort((a, b) => a.at - b.at)
    .forEach(({ exp, at }) => {
      (exp?.competencyTags || []).forEach(tag => {
        if (!seen.has(tag)) seen.set(tag, { label: tag, at, from: titleOf(exp) });
      });
    });
  const rows = [...seen.values()];
  return rows.map((r, i) => ({
    ...r,
    cumulative: i + 1,
    when: `${r.at.getFullYear()}.${String(r.at.getMonth() + 1).padStart(2, '0')}`,
  }));
}

/* ⑤ 반복되는 선택 기준 */
export function buildDecisionCriteria(experiences) {
  const criteria = flatKeyExps(experiences).flatMap(({ ke }) => {
    const list = ke?.decisionTrace?.decisionCriteria;
    return (Array.isArray(list) ? list : [])
      .map(c => ok(typeof c === 'string' ? c : c?.criterion))
      .filter(Boolean);
  });
  return tally(criteria).slice(0, 8);
}

/* ⑥ 강점 vs 공백 — 목표 직군이 요구하는 역량 대비 보유 현황 */
export function buildStrengthGaps(experiences, targetCompetencies = []) {
  const owned = new Set(experiences.flatMap(exp => exp?.competencyTags || []));
  return {
    have: targetCompetencies.filter(c => owned.has(c)),
    missing: targetCompetencies.filter(c => !owned.has(c)),
    extra: [...owned].filter(c => !targetCompetencies.includes(c)).slice(0, 8),
  };
}

/* ⑦ 증거 보유율 */
export function buildEvidenceHealth(experiences) {
  const all = flatKeyExps(experiences).flatMap(({ ke }) => (Array.isArray(ke?.evidenceBundle) ? ke.evidenceBundle : []));
  const counts = { 확보됨: 0, '확인 필요': 0, '추가 필요': 0 };
  all.forEach(e => {
    const key = txt(e?.status);
    if (counts[key] != null) counts[key] += 1;
    else counts['확인 필요'] += 1;
  });
  const total = all.length;
  // 증거가 하나도 없는 경험 = 주장만 있는 경험
  const bare = experiences
    .filter(exp => keyExpsOf(exp).length > 0
      && keyExpsOf(exp).every(ke => !(Array.isArray(ke?.evidenceBundle) && ke.evidenceBundle.length)))
    .map(titleOf)
    .slice(0, 5);
  return { total, counts, bare, securedPct: total ? Math.round((counts['확보됨'] / total) * 100) : 0 };
}

/* ⑧ 내가 자주 다루는 문제 유형 */
const PROBLEM_KINDS = [
  { kind: '사람·조직', re: /사람|팀|소통|협업|이해관계|조직|고객|사용자 반응|설득/ },
  { kind: '구조·프로세스', re: /프로세스|구조|절차|정책|기준|운영|체계|워크플로|흐름/ },
  { kind: '데이터·검증', re: /데이터|지표|분석|검증|실험|가설|측정|통계|로그/ },
  { kind: '기술·구현', re: /기술|구현|성능|버그|배포|코드|아키텍처|인프라|모델/ },
  { kind: '전달·표현', re: /카피|문구|디자인|화면|콘텐츠|메시지|브랜드|UI|UX/ },
];
export function buildProblemKinds(experiences) {
  const kinds = flatKeyExps(experiences).map(({ ke }) => {
    const text = [ke?.decisionTrace?.problemJudgment, ke?.context, ke?.title].map(ok).join(' ');
    if (!text.trim()) return null;
    return (PROBLEM_KINDS.find(p => p.re.test(text)) || {}).kind || '기타';
  }).filter(Boolean);
  return tally(kinds);
}

/* ⑨ 경험 밀도 — 연·월 분포에서 몰입기와 공백기 */
export function buildDensity(experiences) {
  const months = experiences.map(exp => yearMonth(exp?.createdAt)).filter(Boolean)
    .map(d => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`);
  const rows = tally(months).sort((a, b) => a.label.localeCompare(b.label));
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
  return { rows, max };
}

/* ⑩ 정리 이력 — 경험을 다시 손볼수록 서술이 두꺼워진다 */
export function buildRevisionActivity(experiences) {
  const rows = experiences
    .map(exp => {
      const created = yearMonth(exp?.createdAt);
      const updated = yearMonth(exp?.updatedAt);
      if (!created || !updated) return null;
      const days = Math.round((updated - created) / 86400000);
      return days >= 1 ? { title: titleOf(exp), days } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.days - a.days);
  return { rows: rows.slice(0, 6), revisited: rows.length, total: experiences.length };
}
