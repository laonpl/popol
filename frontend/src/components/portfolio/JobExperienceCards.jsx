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
      {s(exp.learning) && <p className="text-[12px] italic leading-[1.6] text-bluewood-400">{s(exp.learning)}</p>}
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
      {s(exp.learning) && <p className="text-[12px] italic leading-[1.6] text-bluewood-400">{s(exp.learning)}</p>}
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
      {s(exp.learning) && <p className="text-[12px] italic leading-[1.6] text-bluewood-400">{s(exp.learning)}</p>}
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
      {s(exp.learning) && <p className="text-[12px] italic leading-[1.6] text-bluewood-400">{s(exp.learning)}</p>}
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
      {s(exp.learning) && <p className="text-[12px] italic leading-[1.6] text-bluewood-400">{s(exp.learning)}</p>}
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
      {s(exp.learning) && <p className="text-[12px] italic leading-[1.6] text-bluewood-400">{s(exp.learning)}</p>}
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
      {s(exp.learning) && <p className="text-[12px] italic leading-[1.6] text-bluewood-400">{s(exp.learning)}</p>}
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
      {s(exp.learning) && <p className="text-[12px] italic leading-[1.6] text-bluewood-400">{s(exp.learning)}</p>}
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
