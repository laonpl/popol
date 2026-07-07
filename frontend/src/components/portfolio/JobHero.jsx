// 직무별 히어로 — 직무마다 레이아웃 구조 자체가 다르다.
// marketer=그라데이션 캠페인 배너+KPI 스트립 / sales=초대형 계약 수치+퍼널 흐름 / hr=채용 여정 파이프라인
// pm=Problem→Impact 대비 블록 / da=리서치 리포트 헤더 / designer=쇼케이스 타이포+블롭
// aiml=모델 카드 / devops=터미널 카드. dev·common은 null(기존 헤더 유지).
import { Github, ExternalLink, ArrowRight, FlaskConical, Lightbulb, Search } from 'lucide-react';
import { tint } from './JobVisuals';

const first = (t, n = 110) => {
  const s = String(t || '').replace(/\*\*/g, '').trim();
  if (!s || s.startsWith('[작성 필요]')) return '';
  const f = s.split(/(?<=[.!?다요음됨함])\s+/)[0] || s;
  return f.length > n ? `${f.slice(0, n - 1)}…` : f;
};

function Chips({ chips, link, isGithubLink, dark = false }) {
  const label = dark ? 'text-white/50' : 'text-bluewood-300';
  const value = dark ? 'text-white/90' : 'text-bluewood-700';
  if (!chips.some(c => c.v) && !link) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
      {chips.filter(c => c.v).map((c, i) => (
        <span key={i}><span className={label}>{c.k} </span><span className={`font-semibold ${value}`}>{c.v}</span></span>
      ))}
      {link && (
        <a href={link} target="_blank" rel="noreferrer"
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-bold transition-colors ${dark ? 'bg-white/15 text-white hover:bg-white/25' : 'border border-surface-200 bg-white text-bluewood-700 hover:border-primary-300'}`}>
          {isGithubLink ? <Github size={13} /> : <ExternalLink size={13} />}
          {isGithubLink ? 'GitHub' : '바로가기'}
        </a>
      )}
    </div>
  );
}

/* ── 마케터: 캠페인 배너 — 풀컬러 그라데이션 + 히어로 KPI 스트립 ── */
function MarketerHero({ p }) {
  const kpis = p.kpis.slice(0, 3);
  return (
    <header className="overflow-hidden rounded-3xl text-white" style={{ background: 'linear-gradient(130deg, #001c45 0%, #002F6C 55%, #4f5f72 100%)' }}>
      <div className="p-7 sm:p-10">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">{p.jobLabel} · CAMPAIGN CASE</p>
        <h1 className="mt-3 max-w-3xl text-[30px] sm:text-[40px] font-black leading-[1.1] tracking-tight">{p.title}</h1>
        {p.headline && <p className="mt-3.5 max-w-2xl text-[14.5px] sm:text-[15.5px] leading-relaxed text-white/85">{p.headline}</p>}
        <div className="mt-5"><Chips chips={p.chips} link={p.link} isGithubLink={p.isGithubLink} dark /></div>
      </div>
      {kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-px bg-white/15 border-t border-white/15">
          {kpis.map((k, i) => (
            <div key={i} className="bg-white/10 px-4 py-4 backdrop-blur-sm sm:px-7">
              <p className="text-[20px] sm:text-[26px] font-black leading-none">{k.value}</p>
              <p className="mt-1.5 truncate text-[11px] font-medium text-white/70">{k.label}</p>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

/* ── 세일즈: 딜 보드 — 초대형 계약 수치 + 퍼널 흐름 요약 ── */
function SalesHero({ p }) {
  const top = p.kpis[0];
  const rest = p.kpis.slice(1, 3);
  return (
    <header className="overflow-hidden rounded-3xl border border-surface-200 bg-gradient-to-br from-surface-50 to-white">
      <div className="h-1.5 w-full" style={{ backgroundColor: p.accent }} />
      <div className="grid gap-6 p-7 sm:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] sm:p-9">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: p.accent }}>{p.jobLabel} · DEAL RECORD</p>
          <h1 className="mt-3 text-[28px] sm:text-[34px] font-black leading-[1.12] tracking-tight text-bluewood-900">{p.title}</h1>
          {p.headline && <p className="mt-3 text-[14px] leading-relaxed text-bluewood-500">{p.headline}</p>}
          <div className="mt-4"><Chips chips={p.chips} link={p.link} isGithubLink={p.isGithubLink} /></div>
        </div>
        {top && (
          <div className="flex flex-col justify-center rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
            <p className="text-[11.5px] font-bold text-bluewood-400">{top.label}</p>
            <p className="mt-2 text-[44px] sm:text-[52px] font-black leading-none" style={{ color: p.accent }}>{top.value}</p>
            {rest.length > 0 && (
              <div className="mt-4 flex gap-5 border-t border-surface-100 pt-3.5">
                {rest.map((k, i) => (
                  <span key={i} className="text-[12px] text-bluewood-500"><span className="font-black text-bluewood-800">{k.value}</span> {k.label}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {p.funnel && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-surface-200 bg-surface-50/60 px-7 py-3.5 sm:px-9">
          {p.funnel.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <span className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ backgroundColor: tint(p.accent, 0.9), color: p.accent }}>
                {s.label} <span className="font-black">{s.value.toLocaleString()}</span>
              </span>
              {i < p.funnel.length - 1 && <ArrowRight size={12} className="text-bluewood-300" />}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

/* ── HR: 채용 여정 — 따뜻한 배너 + 인재 파이프라인 흐름 ── */
function HrHero({ p }) {
  return (
    <header className="rounded-3xl border border-surface-200 bg-gradient-to-br from-surface-50 to-white p-7 sm:p-9">
      <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: p.accent }}>{p.jobLabel} · PEOPLE &amp; CULTURE</p>
      <h1 className="mt-3 max-w-3xl text-[28px] sm:text-[36px] font-black leading-[1.12] tracking-tight text-bluewood-900">{p.title}</h1>
      {p.headline && <p className="mt-3.5 max-w-2xl text-[14.5px] leading-relaxed text-bluewood-500">{p.headline}</p>}
      <div className="mt-5"><Chips chips={p.chips} link={p.link} isGithubLink={p.isGithubLink} /></div>
      {p.funnel ? (
        <div className="mt-6 rounded-2xl border border-surface-200 bg-white/80 p-4">
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-bluewood-300">채용 여정</p>
          <div className="flex flex-wrap items-center gap-2">
            {p.funnel.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                <span className="flex flex-col items-center rounded-xl px-3.5 py-2" style={{ backgroundColor: tint(p.accent, 0.55 * (1 - i / Math.max(1, p.funnel.length - 1))) , color: i > p.funnel.length / 2 ? '#fff' : '#314157' }}>
                  <span className="text-[15px] font-black leading-none">{s.value.toLocaleString()}</span>
                  <span className="mt-1 text-[10.5px] font-semibold opacity-80">{s.label}</span>
                </span>
                {i < p.funnel.length - 1 && <ArrowRight size={14} className="text-bluewood-300" />}
              </span>
            ))}
          </div>
        </div>
      ) : p.kpis.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {p.kpis.slice(0, 3).map((k, i) => (
            <span key={i} className="rounded-xl border border-surface-200 bg-white/80 px-4 py-2.5 text-[12px] text-bluewood-500">
              <span className="mr-1.5 text-[17px] font-black align-middle" style={{ color: p.accent }}>{k.value}</span>{k.label}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

/* ── PM: 전략 브리프 — Problem ↔ Impact 대비 블록 ── */
function PmHero({ p }) {
  const problem = first(p.jobSpecific.strategy, 130) || p.headline;
  const impact = first(p.jobSpecific.businessImpact, 130);
  const topKpi = p.kpis[0];
  return (
    <header>
      <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: p.accent }}>{p.jobLabel} · PRODUCT BRIEF</p>
      <h1 className="mt-3 text-[28px] sm:text-[38px] font-black leading-[1.12] tracking-tight text-bluewood-900">{p.title}</h1>
      <div className="mt-4"><Chips chips={p.chips} link={p.link} isGithubLink={p.isGithubLink} /></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-surface-200 bg-surface-50 p-5">
          <p className="text-[10.5px] font-black uppercase tracking-[0.18em] text-bluewood-400">Problem</p>
          <p className="mt-2 text-[14.5px] font-semibold leading-[1.65] text-bluewood-800">{problem || '어떤 문제를 풀었는지 편집에서 채워보세요.'}</p>
        </div>
        <div className="rounded-2xl p-5 text-white" style={{ backgroundColor: p.accent }}>
          <p className="text-[10.5px] font-black uppercase tracking-[0.18em] text-white/60">Impact</p>
          {topKpi && <p className="mt-2 text-[30px] font-black leading-none">{topKpi.value}<span className="ml-2 align-middle text-[12px] font-semibold text-white/70">{topKpi.label}</span></p>}
          {impact && <p className={`${topKpi ? 'mt-2.5 text-[12.5px] text-white/80' : 'mt-2 text-[14.5px] font-semibold'} leading-[1.65]`}>{impact}</p>}
          {!topKpi && !impact && <p className="mt-2 text-[14.5px] font-semibold leading-[1.65] text-white/90">런칭 후 달성한 변화를 편집에서 채워보세요.</p>}
        </div>
      </div>
    </header>
  );
}

/* ── DA: 분석 리포트 — 모노 메타 라인 + 가설→검증→인사이트 스텝 ── */
function DaHero({ p }) {
  const steps = [
    { icon: Search,       label: '가설 설정',  text: first(p.jobSpecific.hypothesis, 64) },
    { icon: FlaskConical, label: '데이터 검증', text: first(p.jobSpecific.pipeline, 64) },
    { icon: Lightbulb,    label: '인사이트',   text: first(p.jobSpecific.businessInsight, 64) },
  ];
  return (
    <header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-surface-200 py-2 font-mono text-[11px] uppercase tracking-wider text-bluewood-400">
        <span style={{ color: p.accent }}>● ANALYSIS REPORT</span>
        <span>{p.jobLabel}</span>
        {p.chips.filter(c => c.v).map((c, i) => <span key={i}>{c.k}: {c.v}</span>)}
      </div>
      <h1 className="mt-5 text-[28px] sm:text-[38px] font-black leading-[1.12] tracking-tight text-bluewood-900">{p.title}</h1>
      {p.headline && <p className="mt-3.5 max-w-2xl text-[14.5px] leading-relaxed text-bluewood-500">{p.headline}</p>}
      {p.link && <div className="mt-3.5"><Chips chips={[]} link={p.link} isGithubLink={p.isGithubLink} /></div>}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={i} className="rounded-2xl border border-surface-200 p-4" style={{ borderTopWidth: 3, borderTopColor: p.accent }}>
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: p.accent }}>
              <s.icon size={13} /> {`0${i + 1}`} {s.label}
            </p>
            <p className="mt-2 text-[12.5px] leading-[1.6] text-bluewood-600">{s.text || <span className="text-bluewood-300">편집에서 채워보세요</span>}</p>
          </div>
        ))}
      </div>
    </header>
  );
}

/* ── 디자이너: 쇼케이스 — 특대 타이포 + 그라데이션 블롭 + 프로세스 칩 ── */
function DesignerHero({ p }) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-surface-200 bg-white px-7 py-10 text-center sm:px-10 sm:py-14">
      <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full opacity-[0.08] blur-3xl" style={{ backgroundColor: p.accent }} />
      <div className="pointer-events-none absolute -bottom-24 -right-10 h-64 w-64 rounded-full opacity-[0.06] blur-3xl" style={{ backgroundColor: p.accent }} />
      <div className="relative">
        <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: p.accent }}>{p.jobLabel} · CASE STUDY</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-[34px] sm:text-[48px] font-black leading-[1.06] tracking-tight text-bluewood-900">{p.title}</h1>
        {p.headline && <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed text-bluewood-500">{p.headline}</p>}
        <div className="mt-5 flex justify-center"><Chips chips={p.chips} link={p.link} isGithubLink={p.isGithubLink} /></div>
        {p.processSteps && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-1.5">
            {p.processSteps.slice(0, 5).map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <span className="rounded-full border px-3 py-1.5 text-[11.5px] font-bold text-bluewood-700" style={{ borderColor: tint(p.accent, 0.6), backgroundColor: tint(p.accent, 0.94) }}>
                  <span className="mr-1 font-black" style={{ color: p.accent }}>{`0${i + 1}`}</span>{s.label}
                </span>
                {i < Math.min(p.processSteps.length, 5) - 1 && <ArrowRight size={12} className="text-bluewood-300" />}
              </span>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

/* ── AI/ML: 모델 카드 — 그라데이션 보더 + 평가지표 뱃지 ── */
function AimlHero({ p }) {
  return (
    <header className="rounded-3xl p-[1.5px]" style={{ background: `linear-gradient(120deg, ${p.accent}, ${tint(p.accent, 0.5)}, ${p.accent})` }}>
      <div className="rounded-[22px] bg-white p-7 sm:p-9">
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: p.accent }}>
          <span className="rounded px-2 py-0.5" style={{ backgroundColor: tint(p.accent, 0.92) }}>MODEL CARD</span>
          <span className="text-bluewood-300">{p.jobLabel}</span>
        </div>
        <h1 className="mt-3.5 text-[28px] sm:text-[36px] font-black leading-[1.12] tracking-tight text-bluewood-900">{p.title}</h1>
        {p.headline && <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-bluewood-500">{p.headline}</p>}
        <div className="mt-4"><Chips chips={p.chips} link={p.link} isGithubLink={p.isGithubLink} /></div>
        {(p.kpis.length > 0 || p.techList.length > 0) && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-surface-100 pt-4">
            {p.kpis.slice(0, 4).map((k, i) => (
              <span key={`k${i}`} className="rounded-lg px-2.5 py-1.5 font-mono text-[11.5px] font-bold text-white" style={{ backgroundColor: p.accent }}>
                {k.label} <span className="opacity-80">|</span> {k.value}
              </span>
            ))}
            {p.techList.slice(0, 6).map((t, i) => (
              <span key={`t${i}`} className="rounded-lg bg-surface-100 px-2.5 py-1.5 font-mono text-[11.5px] font-semibold text-bluewood-600">{t}</span>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

/* ── 데브옵스: 터미널 카드 — 다크 배경 + 모노 프롬프트 + 파이프라인 도트 ── */
function DevopsHero({ p }) {
  return (
    <header className="overflow-hidden rounded-3xl bg-[#0e1626] text-white">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tint(p.accent, 0.45) }} />
        <span className="font-mono text-[11px] text-white/40">~/{p.jobLabel} — {p.title.slice(0, 24)}</span>
      </div>
      <div className="p-7 sm:p-9">
        <p className="font-mono text-[12px]" style={{ color: tint(p.accent, 0.5) }}>$ cat INFRA_PORTFOLIO.md</p>
        <h1 className="mt-3 text-[27px] sm:text-[34px] font-black leading-[1.12] tracking-tight">{p.title}</h1>
        {p.headline && <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/70">{p.headline}</p>}
        <div className="mt-4"><Chips chips={p.chips} link={p.link} isGithubLink={p.isGithubLink} dark /></div>
        {p.processSteps && (
          <div className="mt-6 flex flex-wrap items-center gap-0 font-mono text-[11.5px]">
            {p.processSteps.slice(0, 5).map((s, i) => (
              <span key={i} className="inline-flex items-center">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-white/90" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tint(p.accent, 0.5) }} />{s.label}
                </span>
                {i < Math.min(p.processSteps.length, 5) - 1 && <span className="px-1.5 text-white/30">──▶</span>}
              </span>
            ))}
          </div>
        )}
        {p.techList.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {p.techList.slice(0, 8).map((t, i) => <span key={i} className="font-mono text-[11px] text-white/50">#{t}</span>)}
          </div>
        )}
      </div>
    </header>
  );
}

const HEROES = { marketer: MarketerHero, sales: SalesHero, hr: HrHero, pm: PmHero, da: DaHero, designer: DesignerHero, aiml: AimlHero, devops: DevopsHero };

export default function JobHero(props) {
  const Hero = HEROES[props.job];
  return Hero ? <Hero p={props} /> : null;
}
