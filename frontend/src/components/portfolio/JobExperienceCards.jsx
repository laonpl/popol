// 직무별 핵심 경험 카드 — 직무마다 "경험의 단위"와 구성 요소가 다르다.
// 마케터=캠페인(타겟·채널·KPI) / PM=의사결정(결정·대안·검증·설득) / 디자이너=개선 반복(페인포인트→결정→테스트)
// DA=분석(가설→방법→발견→액션) / HR=프로그램(과제→설계→변화) / 세일즈=딜(고객→접근→협상→계약)
// AI/ML=실험(데이터→모델→지표) / 데브옵스=인시던트(상황→원인→조치→개선).
// AI가 추출한 exp.jobData를 우선 사용하고, 없으면 CARL 필드를 직무 용어로 재해석해 표현한다.
import { Check, ArrowRight, Users, Megaphone, FlaskConical, Database, Building2, Siren } from 'lucide-react';
import { tint } from './JobVisuals';

const s = (v) => {
  const t = String(v ?? '').trim();
  return !t || t.startsWith('[작성 필요]') || t.startsWith('[검증 필요]') ? '' : t.replace(/\*\*/g, '');
};
const arr = (v) => (Array.isArray(v) ? v.map(x => s(typeof x === 'string' ? x : x?.name || '')).filter(Boolean) : []);

/* 카드 공통 셸: 직무 kicker + 번호 + 제목 */
function Shell({ kicker, index, title, accent, right, children }) {
  return (
    <div className="rounded-2xl border border-surface-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>{kicker} {String(index + 1).padStart(2, '0')}</p>
          <h3 className="mt-1 text-[15.5px] font-extrabold leading-snug text-bluewood-900">{title}</h3>
        </div>
        {right}
      </div>
      <div className="mt-3.5 space-y-3">{children}</div>
    </div>
  );
}

/* 전 직군 공통 꼬리말 — 배운 점 + 솔직 회고(막힌 지점·오판·남은 한계·다시 한다면).
   "결과가 너무 완벽해 사람 냄새가 안 난다"는 인사담당자 피드백에 대응하는 블록으로,
   면접에서 실제로 파고드는 지점이라 성과 나열보다 신뢰를 만든다. AI가 근거를 못 찾으면 렌더되지 않는다. */
const REVIEW_ROWS = [
  { key: 'struggle', label: '막혔던 지점' },
  { key: 'misjudgment', label: '예상과 달랐던 점' },
  { key: 'limitation', label: '남은 한계' },
  { key: 'nextTime', label: '다시 한다면' },
];
function CardFootnote({ exp, accent }) {
  const review = exp.honestReview || {};
  const rows = REVIEW_ROWS.map(r => ({ ...r, text: s(review[r.key]) })).filter(r => r.text);
  const learning = s(exp.learning);
  const trace = exp.decisionTrace || {};
  const voice = exp.voiceRecord || {};
  const identity = exp.identitySignal || {};
  const alternatives = (Array.isArray(trace.alternatives) ? trace.alternatives : [])
    .map(item => {
      if (typeof item === 'string') return s(item);
      const option = s(item?.option);
      const reason = s(item?.reasonNotChosen) || s(item?.cons) || s(item?.pros);
      return [option, reason].filter(Boolean).join(' — ');
    })
    .filter(Boolean);
  const criteria = (Array.isArray(trace.decisionCriteria) ? trace.decisionCriteria : [])
    .map(item => {
      if (typeof item === 'string') return s(item);
      return [s(item?.criterion), s(item?.why)].filter(Boolean).join(' — ');
    })
    .filter(Boolean);
  const evidence = (Array.isArray(exp.evidenceBundle) ? exp.evidenceBundle : [])
    .filter(item => s(item?.claim) || s(item?.sourceRef) || s(item?.whatItProves))
    .slice(0, 4);
  const decisionSteps = [
    { label: '문제 판단', text: s(trace.problemJudgment) || s(trace.situation) },
    { label: '판단 근거', text: s(trace.problemEvidence) },
    { label: '선택', text: s(trace.choice) },
    { label: '바뀐 원칙', text: s(trace.newPrinciple) || s(trace.changedJudgment) },
  ].filter(item => item.text);
  // scope — 이 경험이 다른 조직으로 옮겨질 수 있는지 판단하는 축(팀 규모·내 권한·다룬 규모·제약).
  // 같은 직무라도 스타트업과 대기업이 완전히 다른 일이므로, 있으면 카드 맨 앞에 메타 줄로 보여준다.
  const scope = exp.scope || {};
  const scopeChips = [
    { label: '팀', text: s(scope.teamSize) },
    { label: '내 권한', text: s(scope.myAuthority) },
    { label: '규모', text: s(scope.scale) },
    { label: '제약', text: s(scope.constraints) },
  ].filter(c => c.text);
  const hasDeepRecord = decisionSteps.length > 0 || alternatives.length > 0 || criteria.length > 0
    || s(voice.originalQuote) || s(voice.aiMeaning) || evidence.length > 0 || s(identity.sentence);
  if (!learning && rows.length === 0 && !hasDeepRecord && scopeChips.length === 0) return null;
  return (
    <div className="space-y-3 border-t border-dashed border-surface-200 pt-3">
      {scopeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {scopeChips.map(c => (
            <span key={c.label} className="inline-flex items-center gap-1 rounded-md bg-surface-100 px-2 py-1 text-[11px] text-bluewood-600">
              <span className="font-bold text-bluewood-400">{c.label}</span>
              <span className="font-semibold">{c.text.length > 46 ? `${c.text.slice(0, 45)}…` : c.text}</span>
            </span>
          ))}
        </div>
      )}
      {hasDeepRecord && (
        <details className="group rounded-xl bg-surface-50 px-3.5 py-3">
          <summary className="cursor-pointer list-none text-[11px] font-black text-bluewood-600">
            <span style={{ color: accent }}>판단 지도</span>
            <span className="mx-1.5 text-surface-300">·</span>말투와 증거 보기
          </summary>
          <div className="mt-3 space-y-3">
            {decisionSteps.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {decisionSteps.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="rounded-lg bg-white p-2.5">
                    <p className="text-[10px] font-bold" style={{ color: accent }}>{item.label}</p>
                    <p className="mt-1 text-[12px] leading-[1.6] text-bluewood-600">{item.text}</p>
                  </div>
                ))}
              </div>
            )}
            {(alternatives.length > 0 || criteria.length > 0) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {alternatives.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-bold text-bluewood-400">검토한 대안</p>
                    {alternatives.map((text, index) => <p key={index} className="text-[12px] leading-[1.6] text-bluewood-600">· {text}</p>)}
                  </div>
                )}
                {criteria.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-bold text-bluewood-400">선택 기준</p>
                    {criteria.map((text, index) => <p key={index} className="text-[12px] leading-[1.6] text-bluewood-600">· {text}</p>)}
                  </div>
                )}
              </div>
            )}
            {s(voice.originalQuote) && (
              <blockquote className="rounded-lg border-l-2 bg-white px-3 py-2.5" style={{ borderColor: accent }}>
                <p className="text-[12.5px] leading-[1.65] text-bluewood-700">“{s(voice.originalQuote)}”</p>
                {s(voice.aiMeaning) && <p className="mt-1 text-[10.5px] text-bluewood-400">AI 해석 · {s(voice.aiMeaning)}</p>}
              </blockquote>
            )}
            {evidence.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-bold text-bluewood-400">연결된 증거</p>
                <div className="space-y-1">
                  {evidence.map((item, index) => (
                    <p key={index} className="text-[11.5px] leading-[1.55] text-bluewood-600">
                      <span className="font-bold">{s(item.sourceRef) || s(item.type) || `근거 ${index + 1}`}</span>
                      {(s(item.whatItProves) || s(item.claim)) && ` · ${s(item.whatItProves) || s(item.claim)}`}
                      {s(item.status) && <span className="ml-1 text-bluewood-300">({s(item.status)})</span>}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {s(identity.sentence) && (
              <p className="rounded-lg px-3 py-2 text-[12px] font-semibold leading-[1.6]" style={{ backgroundColor: tint(accent, 0.94), color: accent }}>
                나를 보여주는 한 문장 · “{s(identity.sentence)}”
              </p>
            )}
          </div>
        </details>
      )}
      {learning && <p className="text-[12px] italic leading-[1.6] text-bluewood-400">{learning}</p>}
      {rows.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-bluewood-300">Honest Review</p>
          {rows.map(r => (
            <p key={r.key} className="text-[12px] leading-[1.65] text-bluewood-500">
              <span className="font-bold" style={{ color: accent }}>{r.label}</span>
              <span className="mx-1.5 text-surface-300">·</span>{r.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, color, children, strong = false }) {
  if (!children) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold" style={{ color }}>{label}</p>
      <p className={`text-[13px] leading-[1.7] ${strong ? 'font-semibold text-bluewood-900' : 'text-bluewood-600'}`}>{children}</p>
    </div>
  );
}

/* ── 마케터: 캠페인 카드 — 타겟·채널·크리에이티브 + KPI 스트립 ── */
function CampaignCard({ exp, index, accent }) {
  const jd = exp.jobData || {};
  const channels = arr(jd.channels);
  const kpis = (Array.isArray(jd.kpis) ? jd.kpis : []).filter(k => s(k?.name) && s(k?.value));
  const metric = s(exp.afterMetric) || s(exp.metric);
  return (
    <Shell kicker="CAMPAIGN" index={index} title={s(exp.title) || `캠페인 ${index + 1}`} accent={accent}>
      {(s(jd.target) || channels.length > 0 || s(jd.creative)) && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-surface-50 p-2.5 text-[11.5px]">
          {s(jd.target) && <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-semibold text-bluewood-700 shadow-sm"><Users size={11} style={{ color: accent }} /> {s(jd.target)}</span>}
          {channels.map((c, i) => <span key={i} className="rounded-md px-2 py-1 font-bold" style={{ backgroundColor: tint(accent, 0.9), color: accent }}>{c}</span>)}
          {s(jd.creative) && <span className="inline-flex items-center gap-1 text-bluewood-500"><Megaphone size={11} /> {s(jd.creative)}</span>}
        </div>
      )}
      <Row label="전략 · 실행" color={accent}>{s(exp.action) || s(exp.context)}</Row>
      {(kpis.length > 0 || metric) && (
        <div className="flex flex-wrap gap-2">
          {(kpis.length ? kpis : [{ name: s(exp.metricLabel) || '성과', value: metric }]).map((k, i) => (
            <span key={i} className="rounded-lg border border-surface-200 px-3 py-1.5 text-[11.5px] text-bluewood-500">
              {s(k.name)} <span className="ml-1 text-[15px] font-black align-middle" style={{ color: accent }}>{s(k.value)}</span>
            </span>
          ))}
        </div>
      )}
      <Row label="성과 해석" color="#047857" strong>{s(exp.result)}</Row>
      <CardFootnote exp={exp} accent={accent} />
    </Shell>
  );
}

/* ── PM: 의사결정 카드 — 문제 → 결정(강조) → 대안 → 검증 → 이해관계자 ── */
function DecisionCard({ exp, index, accent }) {
  const jd = exp.jobData || {};
  const decision = s(jd.decision) || s(exp.action);
  return (
    <Shell kicker="DECISION" index={index} title={s(exp.title) || `의사결정 ${index + 1}`} accent={accent}
      right={s(exp.metric) && <span className="flex-shrink-0 rounded-md bg-caribbean-50 px-2 py-1 text-[11.5px] font-bold text-caribbean-700">{s(exp.afterMetric) || s(exp.metric)}</span>}>
      <Row label="문제 상황" color="#314157">{s(exp.context)}</Row>
      {decision && (
        <div className="rounded-xl p-3.5" style={{ backgroundColor: tint(accent, 0.93), borderLeft: `3px solid ${accent}` }}>
          <p className="text-[11px] font-bold" style={{ color: accent }}>내린 결정</p>
          <p className="mt-1 text-[13.5px] font-bold leading-[1.65] text-bluewood-900">{decision}</p>
          {s(jd.alternatives) && <p className="mt-1.5 text-[12px] leading-[1.6] text-bluewood-500">↳ 검토한 대안: {s(jd.alternatives)}</p>}
        </div>
      )}
      <Row label="검증 · 결과" color="#047857" strong>{s(jd.validation) || s(exp.result)}</Row>
      {s(jd.stakeholders) && (
        <p className="flex items-start gap-1.5 text-[12px] leading-[1.6] text-bluewood-500"><Users size={13} className="mt-0.5 flex-shrink-0" style={{ color: accent }} /> {s(jd.stakeholders)}</p>
      )}
      <CardFootnote exp={exp} accent={accent} />
    </Shell>
  );
}

/* ── 디자이너: 개선 반복 카드 — 페인포인트 / 디자인 결정 / 테스트 결과 3패널 ── */
function IterationCard({ exp, index, accent }) {
  const jd = exp.jobData || {};
  const panels = [
    { label: 'PAIN POINT', text: s(jd.painPoint) || s(exp.context), bg: '#f4f6f8', color: '#314157' },
    { label: 'DESIGN DECISION', text: s(jd.designDecision) || s(exp.action), bg: tint(accent, 0.94), color: accent },
    { label: 'TEST RESULT', text: s(jd.testResult) || s(exp.result), bg: '#eefff5', color: '#047857' },
  ].filter(p => p.text);
  return (
    <Shell kicker="ITERATION" index={index} title={s(exp.title) || `개선 ${index + 1}`} accent={accent}
      right={(s(exp.afterMetric) || s(exp.metric)) && <span className="flex-shrink-0 rounded-md bg-caribbean-50 px-2 py-1 text-[11.5px] font-bold text-caribbean-700">{s(exp.afterMetric) || s(exp.metric)}</span>}>
      <div className={`grid gap-2 ${panels.length === 3 ? 'sm:grid-cols-3' : panels.length === 2 ? 'sm:grid-cols-2' : ''}`}>
        {panels.map((p, i) => (
          <div key={i} className="rounded-xl p-3.5" style={{ backgroundColor: p.bg }}>
            <p className="font-mono text-[10px] font-bold tracking-[0.14em]" style={{ color: p.color }}>{p.label}</p>
            <p className="mt-1.5 text-[12.5px] leading-[1.65] text-bluewood-700">{p.text}</p>
          </div>
        ))}
      </div>
      <CardFootnote exp={exp} accent={accent} />
    </Shell>
  );
}

/* ── DA: 분석 카드 — 가설 → 방법 → 발견(하이라이트) → 비즈니스 액션 ── */
function AnalysisCard({ exp, index, accent }) {
  const jd = exp.jobData || {};
  const finding = s(jd.finding) || s(exp.result);
  return (
    <Shell kicker="ANALYSIS" index={index} title={s(exp.title) || `분석 ${index + 1}`} accent={accent}>
      {(s(jd.hypothesis) || s(exp.context)) && (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex-shrink-0 rounded bg-surface-100 px-1.5 py-0.5 font-mono text-[11px] font-black" style={{ color: accent }}>H₁</span>
          <p className="text-[13.5px] font-semibold leading-[1.65] text-bluewood-800">{s(jd.hypothesis) || s(exp.context)}</p>
        </div>
      )}
      {(s(jd.method) || s(exp.action)) && (
        <p className="flex items-start gap-1.5 text-[12.5px] leading-[1.65] text-bluewood-500">
          <FlaskConical size={13} className="mt-0.5 flex-shrink-0" style={{ color: accent }} />
          <span><span className="font-bold text-bluewood-700">검증 방법 · </span>{s(jd.method) || s(exp.action)}</span>
        </p>
      )}
      {finding && (
        <div className="rounded-xl p-3.5" style={{ backgroundColor: tint(accent, 0.93) }}>
          <p className="text-[11px] font-bold" style={{ color: accent }}>발견</p>
          <p className="mt-1 text-[13.5px] font-bold leading-[1.65] text-bluewood-900">{finding}</p>
        </div>
      )}
      {s(jd.businessAction) && (
        <p className="flex items-start gap-1.5 text-[13px] font-semibold leading-[1.6] text-bluewood-800">
          <ArrowRight size={14} className="mt-0.5 flex-shrink-0 text-caribbean-700" /> {s(jd.businessAction)}
        </p>
      )}
      <CardFootnote exp={exp} accent={accent} />
    </Shell>
  );
}

/* ── HR: 프로그램 카드 — 조직 과제 → 설계·운영 → 지표 변화 ── */
function ProgramCard({ exp, index, accent }) {
  const jd = exp.jobData || {};
  return (
    <Shell kicker="PROGRAM" index={index} title={s(exp.title) || `프로그램 ${index + 1}`} accent={accent}
      right={(s(exp.afterMetric) || s(exp.metric)) && <span className="flex-shrink-0 rounded-md px-2 py-1 text-[11.5px] font-bold" style={{ backgroundColor: tint(accent, 0.9), color: accent }}>{s(exp.afterMetric) || s(exp.metric)}</span>}>
      <Row label="조직 과제" color="#314157">{s(jd.goal) || s(exp.context)}</Row>
      <Row label="설계 · 운영" color={accent}>{s(jd.program) || s(exp.action)}</Row>
      <Row label="변화" color="#047857" strong>{s(jd.funnelChange) || s(exp.result)}</Row>
      <CardFootnote exp={exp} accent={accent} />
    </Shell>
  );
}

/* ── 세일즈: 딜 카드 — 고객 뱃지 + 계약 규모 크게 + 접근→협상→성과 ── */
function DealCard({ exp, index, accent }) {
  const jd = exp.jobData || {};
  const dealSize = s(jd.dealSize) || s(exp.afterMetric) || s(exp.metric);
  return (
    <Shell kicker="DEAL" index={index} title={s(exp.title) || `딜 ${index + 1}`} accent={accent}
      right={dealSize && (
        <div className="flex-shrink-0 rounded-xl px-3.5 py-2 text-right" style={{ backgroundColor: tint(accent, 0.92) }}>
          <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: accent }}>계약 성과</p>
          <p className="text-[18px] font-black leading-tight" style={{ color: accent }}>{dealSize}</p>
        </div>
      )}>
      {s(jd.client) && (
        <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-bluewood-700"><Building2 size={14} style={{ color: accent }} /> {s(jd.client)}</p>
      )}
      <Row label="상황 · 니즈" color="#314157">{s(exp.context)}</Row>
      <Row label="접근 · 제안" color={accent}>{s(jd.approach) || s(exp.action)}</Row>
      {s(jd.negotiation) && <Row label="협상 돌파" color="#b45309">{s(jd.negotiation)}</Row>}
      <Row label="결과" color="#047857" strong>{s(exp.result)}</Row>
      <CardFootnote exp={exp} accent={accent} />
    </Shell>
  );
}

/* ── AI/ML: 실험 카드 — 데이터·모델 태그 + 왜 이 모델 + 지표 뱃지 ── */
function ExperimentCard({ exp, index, accent }) {
  const jd = exp.jobData || {};
  const metrics = (Array.isArray(jd.metrics) ? jd.metrics : []).filter(m => s(m?.name) && s(m?.value));
  const fallbackMetric = s(exp.afterMetric) || s(exp.metric);
  return (
    <Shell kicker="EXPERIMENT" index={index} title={s(exp.title) || `실험 ${index + 1}`} accent={accent}>
      {(s(jd.dataset) || s(jd.model)) && (
        <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
          {s(jd.dataset) && <span className="inline-flex items-center gap-1 rounded-md bg-surface-100 px-2 py-1 font-semibold text-bluewood-600"><Database size={11} /> {s(jd.dataset)}</span>}
          {s(jd.model) && <span className="rounded-md px-2 py-1 font-bold text-white" style={{ backgroundColor: accent }}>{s(jd.model)}</span>}
        </div>
      )}
      <Row label="문제 · 데이터" color="#314157">{s(exp.context)}</Row>
      {s(jd.whyModel) && (
        <div className="rounded-xl p-3" style={{ backgroundColor: tint(accent, 0.94) }}>
          <p className="text-[11px] font-bold" style={{ color: accent }}>왜 이 모델인가</p>
          <p className="mt-1 text-[12.5px] leading-[1.65] text-bluewood-700">{s(jd.whyModel)}</p>
        </div>
      )}
      {!s(jd.whyModel) && <Row label="접근" color={accent}>{s(exp.action)}</Row>}
      {(metrics.length > 0 || fallbackMetric) && (
        <div className="flex flex-wrap gap-1.5">
          {(metrics.length ? metrics : [{ name: s(exp.metricLabel) || 'METRIC', value: fallbackMetric }]).map((m, i) => (
            <span key={i} className="rounded-md border px-2.5 py-1 font-mono text-[11.5px] font-bold" style={{ borderColor: tint(accent, 0.6), color: accent }}>
              {s(m.name)}={s(m.value)}
            </span>
          ))}
        </div>
      )}
      <Row label="결과 해석" color="#047857" strong>{s(exp.result)}</Row>
      <CardFootnote exp={exp} accent={accent} />
    </Shell>
  );
}

/* ── 데브옵스: 인시던트/개선 카드 — 상황→원인→조치→개선 체인 ── */
function OpsCard({ exp, index, accent }) {
  const jd = exp.jobData || {};
  const chain = [
    { label: '상황', icon: Siren, text: s(jd.incident) || s(exp.context), color: '#e11d48' },
    { label: '원인', icon: null, text: s(jd.rootCause), color: '#b45309' },
    { label: '조치', icon: null, text: s(jd.actionTaken) || s(exp.action), color: accent },
    { label: '개선', icon: Check, text: s(jd.impact) || s(exp.result), color: '#047857' },
  ].filter(c => c.text);
  return (
    <Shell kicker="INCIDENT / OPS" index={index} title={s(exp.title) || `개선 ${index + 1}`} accent={accent}
      right={(s(exp.afterMetric) || s(exp.metric)) && <span className="flex-shrink-0 rounded-md bg-caribbean-50 px-2 py-1 font-mono text-[11.5px] font-bold text-caribbean-700">{s(exp.afterMetric) || s(exp.metric)}</span>}>
      <div className="space-y-0">
        {chain.map((c, i) => (
          <div key={i} className="relative flex gap-3 pb-3 last:pb-0">
            {i < chain.length - 1 && <span className="absolute left-[7px] top-5 bottom-0 w-px bg-surface-200" />}
            <span className="mt-1 h-[15px] w-[15px] flex-shrink-0 rounded-full border-[3px] bg-white" style={{ borderColor: c.color }} />
            <div className="min-w-0">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wide" style={{ color: c.color }}>{c.label}</span>
              <p className={`text-[13px] leading-[1.65] ${i === chain.length - 1 ? 'font-semibold text-bluewood-900' : 'text-bluewood-600'}`}>{c.text}</p>
            </div>
          </div>
        ))}
      </div>
      <CardFootnote exp={exp} accent={accent} />
    </Shell>
  );
}

const CARDS = {
  marketer: CampaignCard, pm: DecisionCard, designer: IterationCard, da: AnalysisCard,
  hr: ProgramCard, sales: DealCard, aiml: ExperimentCard, devops: OpsCard,
};

export default function JobExperienceCard({ job, exp, index, accent }) {
  const Card = CARDS[job];
  return Card ? <Card exp={exp} index={index} accent={accent} /> : null;
}
export const hasJobExperienceCard = (job) => Boolean(CARDS[job]);
