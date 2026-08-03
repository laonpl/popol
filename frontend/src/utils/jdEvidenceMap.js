/**
 * jdEvidenceMap — 채용공고가 요구하는 역량 × 그것을 증명하는 내 증거 × 공백.
 *
 * 배경: jobAnalysis(채용공고 분석)는 "정리 기준이 달라지는 축"으로 선언돼 있었지만
 * 정작 산출물 어디에도 다시 등장하지 않았다. 스킬 기반 채용에서 심사자가 보는 단위는
 * "무슨 경험을 했나"가 아니라 "요구 역량 ↔ 그걸 증명하는 근거"다.
 * 필요한 데이터(jobAnalysis · keyExperiences.jobData · evidenceBundle · artifactAnalysis)는
 * 이미 전부 저장돼 있으므로 여기서는 조립만 한다.
 *
 * 설계 규칙
 * 1) AI를 부르지 않는다. 토큰 겹침으로만 맞춘다 (크레딧 0, 결과 재현 가능).
 * 2) 억지 매칭을 만들지 않는다. 애매하면 matched 가 아니라 gap 으로 남긴다.
 * 3) 근거 강도(A~D)를 함께 들고 다닌다. "서술만 있음"과 "자료로 확인됨"을 섞지 않는다.
 */

const txt = (v) => String(v ?? '').trim();
const PLACEHOLDER = /^\s*\[(작성|검증|확인)\s*필요\]/;
const ok = (v) => {
  const t = txt(v);
  return t && !PLACEHOLDER.test(t) ? t : '';
};

/* 겹침 계산에서 제외 — 어느 공고에나 나오는 말들 */
const STOPWORDS = new Set([
  '경험', '능력', '역량', '업무', '관련', '이상', '우대', '필수', '가능', '보유', '수준', '기본',
  '커뮤니케이션', '사용', '활용', '이해', '지식', '및', '또는', '등', '자', '분', '년차', '신입',
  'and', 'or', 'the', 'with', 'for', 'skill', 'experience', 'years',
]);

/** 한글·영문·숫자 토큰 2자 이상, 불용어 제외 */
function tokenize(value) {
  return [...new Set(
    txt(value).toLowerCase().match(/[가-힣a-z0-9+#.]{2,}/g) || []
  )].filter(t => !STOPWORDS.has(t));
}

/* ── 요구 역량 수집 ─────────────────────────────────────────────── */

const REQ_KIND_ORDER = { 필수: 0, 핵심역량: 1, 우대: 2, 스킬: 3 };

/**
 * jobAnalysis 에서 "심사 기준" 목록을 만든다.
 * 같은 말이 requirements/skills/keyCompetencies 에 중복돼 들어오므로 텍스트로 중복 제거한다.
 */
export function collectRequirements(jobAnalysis = {}) {
  const ja = jobAnalysis || {};
  const rows = [];
  const push = (text, kind, weight = null) => {
    const t = ok(text);
    if (!t || t.length > 120) return;
    rows.push({ text: t, kind, weight });
  };

  (ja.requirements?.essential || []).forEach(r => push(r, '필수'));
  (ja.positionAnalysis?.keyCompetencies || []).forEach(c => push(c?.name || c, '핵심역량', c?.weight ?? null));
  (ja.requirements?.preferred || []).forEach(r => push(r, '우대'));
  (ja.skillImportance || []).forEach(s => push(s?.skill || s, '스킬', s?.weight ?? null));
  (ja.skills || []).forEach(s => push(s, '스킬'));

  const seen = new Set();
  return rows
    .filter(row => {
      const key = row.text.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (REQ_KIND_ORDER[a.kind] - REQ_KIND_ORDER[b.kind]) || (Number(b.weight || 0) - Number(a.weight || 0)))
    .slice(0, 18);
}

/* ── 내 증거 수집 ──────────────────────────────────────────────── */

/** evidenceBundle.status → 근거 강도. 자료가 손에 있는 것만 B 이상으로 본다. */
const STATUS_LEVEL = { '확보됨': 'B', '확인 필요': 'C', '추가 필요': 'D' };
const LEVEL_RANK = { A: 0, B: 1, C: 2, D: 3 };
const LEVEL_LABEL = {
  A: '자료로 확인 (로그·발행물·원데이터)',
  B: '과정 자료 확인 (초안·승인·회의록)',
  C: '출처 불완전',
  D: '서술만 있음',
};

/**
 * 경험들에서 "주장 + 근거 강도" 목록을 뽑는다.
 * @param experiences [{ title, structuredResult }]
 */
export function collectClaims(experiences = []) {
  const claims = [];
  const add = (text, { level, from, source, detail }) => {
    const t = ok(text);
    if (!t) return;
    claims.push({ text: t, level, from, source, detail: ok(detail) });
  };

  experiences.forEach((exp) => {
    const sr = exp?.structuredResult || {};
    const from = ok(exp?.title) || ok(sr.projectOverview?.title) || '';

    // ① 근거 장부 — 유일하게 원본 위치가 붙은 주장
    (sr.artifactAnalysis?.evidenceLedger || []).forEach((row) => {
      const level = LEVEL_RANK[row?.proofLevel] != null ? row.proofLevel : 'C';
      add(row?.claim, { level, from, source: '근거 장부', detail: row?.location || row?.directObservation });
    });

    (Array.isArray(sr.keyExperiences) ? sr.keyExperiences : []).forEach((ke) => {
      // ② 경험별 증거 번들
      (Array.isArray(ke?.evidenceBundle) ? ke.evidenceBundle : []).forEach((ev) => {
        add(ev?.claim || ev?.whatItProves, {
          level: STATUS_LEVEL[txt(ev?.status)] || 'C',
          from,
          source: ok(ev?.sourceRef) || ok(ev?.type) || '증거 번들',
          detail: ev?.ownership,
        });
      });

      // ③ 경험 자체 — 자료 연결이 없으므로 서술(D)로만 센다
      const keywords = (Array.isArray(ke?.keywords) ? ke.keywords : []).map(ok).filter(Boolean);
      add([ok(ke?.title), keywords.join(' ')].filter(Boolean).join(' '), {
        level: 'D',
        from,
        source: '경험 서술',
        detail: ok(ke?.metricLabel) && ok(ke?.metric) ? `${ke.metricLabel} ${ke.metric}` : '',
      });

      // ④ 직군 특화 추출값 — 문자열 필드만
      Object.values(ke?.jobData || {}).forEach((v) => {
        if (typeof v === 'string') add(v, { level: 'D', from, source: '직군 항목' });
      });
    });

    // ⑤ 직군 섹션 본문
    Object.values(sr.jobSpecific || {}).forEach((v) => {
      if (typeof v === 'string') add(v, { level: 'D', from, source: '직군 섹션' });
    });
  });

  return claims;
}

/* ── 매칭 ──────────────────────────────────────────────────────── */

/** 요구 역량 토큰이 주장 본문에 얼마나 들어있는지. 0~1 */
function overlap(reqTokens, claimText) {
  if (!reqTokens.length) return { score: 0, hits: [] };
  const lower = claimText.toLowerCase();
  const hits = reqTokens.filter(t => lower.includes(t));
  return { score: hits.length / reqTokens.length, hits };
}

/**
 * 요구 역량 × 증거 매핑.
 * @returns { rows, summary, hasJobAnalysis }
 *   rows[]: { requirement, kind, weight, status, matched[], gap }
 *   status: '근거 있음' | '서술만 있음' | '공백'
 */
export function buildJdEvidenceMap({ jobAnalysis = null, experiences = [] } = {}) {
  const requirements = collectRequirements(jobAnalysis);
  if (!requirements.length) {
    return { rows: [], summary: null, hasJobAnalysis: false };
  }

  const claims = collectClaims(experiences);

  const rows = requirements.map((req) => {
    const tokens = tokenize(req.text);
    const scored = claims
      .map((claim) => {
        const { score, hits } = overlap(tokens, claim.text);
        return { ...claim, score, hits };
      })
      // 겹침이 절반 이상이거나, 서로 다른 토큰 2개 이상이 실제로 등장할 때만 근거로 인정
      .filter(c => c.score >= 0.5 || c.hits.length >= 2)
      .sort((a, b) => (LEVEL_RANK[a.level] - LEVEL_RANK[b.level]) || (b.score - a.score));

    // 같은 문장이 여러 경로로 들어오므로 앞 40자로 중복 제거
    const seen = new Set();
    const matched = scored.filter((c) => {
      const key = c.text.slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);

    const best = matched[0];
    const status = !best ? '공백'
      : LEVEL_RANK[best.level] <= 1 ? '근거 있음'
        : '서술만 있음';

    return {
      requirement: req.text,
      kind: req.kind,
      weight: req.weight,
      status,
      matched: matched.map(m => ({
        text: m.text.length > 160 ? `${m.text.slice(0, 159)}…` : m.text,
        level: m.level,
        levelLabel: LEVEL_LABEL[m.level],
        source: m.source,
        from: m.from,
        detail: m.detail,
      })),
      gap: status === '공백'
        ? '이 역량을 증명하는 경험이 아직 정리돼 있지 않습니다.'
        : status === '서술만 있음'
          ? '주장은 있으나 확인할 자료가 연결되지 않았습니다.'
          : '',
    };
  });

  const summary = {
    total: rows.length,
    evidenced: rows.filter(r => r.status === '근거 있음').length,
    narrativeOnly: rows.filter(r => r.status === '서술만 있음').length,
    gaps: rows.filter(r => r.status === '공백').length,
    essentialGaps: rows.filter(r => r.status === '공백' && r.kind === '필수').length,
  };

  return { rows, summary, hasJobAnalysis: true };
}

export { LEVEL_LABEL, LEVEL_RANK };
