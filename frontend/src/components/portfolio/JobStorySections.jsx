// 직무별 스토리 섹션 패널 — 항상 존재하는 "텍스트 섹션"을 직무 정체성이 있는 비주얼 패널로 렌더.
// 텍스트 속 수치(ROAS 350%, 1200ms 등)를 자동 추출해 ① 본문 안에서 하이라이트 ② 큰 숫자 콜아웃으로 띄운다.
// 개발자의 GitHub 그래프·터미널처럼, 데이터가 얕아도 각 직무 화면이 한눈에 다르게 보이는 게 목적.
// devops=터미널 / aiml=모델카드 / da=분석 리포트 / marketer=캠페인 보드 / sales=딜 시트
// hr=피플 패널 / pm=전략 브리프 / designer=케이스 스터디 스프레드.
import { tint } from './JobVisuals';

const clean = (v) => String(v ?? '').replace(/\*\*/g, '').replace(/^#+\s/gm, '').trim();

// 수치 구절: KPI 약어+숫자 또는 숫자+단위 (전역 매칭용 — 호출마다 새로 생성해 lastIndex 오염 방지)
const metricRe = () => /(?:ROAS|CVR|CTR|CPA|CAC|ARR|MRR|DAU|MAU|WAU|NPS|MTTR|SLA|F1|AUC)\s*[:\-]?\s*\d[\d,.]*\s*%?|\d[\d,.]*\s*(?:%|배|건|명|억\s?원|억|만\s?원|천만\s?원|원|시간|분|초|ms|점|위|개|pt|TPS|RPS|x)/gi;

// 본문에서 대표 수치 구절 추출 (중복 제거, 연도 제외)
export function extractMetricPhrases(text, max = 3) {
  const s = clean(text);
  const out = [];
  const seen = new Set();
  const re = metricRe();
  let m;
  while ((m = re.exec(s)) && out.length < max) {
    const t = m[0].trim();
    if (/^(?:19|20)\d{2}(?:년)?$/.test(t)) continue; // 연도 오탐 제외
    if (!seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}

// 본문 렌더 — 수치 구절을 강조 스팬으로 감싼다
function HighlightedText({ text, color, mono = false, dark = false }) {
  const s = clean(text);
  const re = metricRe();
  const parts = [];
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(s))) {
    if (/^(?:19|20)\d{2}(?:년)?$/.test(m[0].trim())) continue;
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push(
      <strong key={k++} className={mono ? 'font-mono' : ''} style={{ color, fontWeight: 800 }}>{m[0]}</strong>
    );
    last = m.index + m[0].length;
  }
  parts.push(s.slice(last));
  return (
    <p className={`whitespace-pre-wrap text-[13px] leading-[1.85] ${mono ? 'font-mono text-[12.5px]' : ''} ${dark ? 'text-white/75' : 'text-bluewood-600'}`}>
      {parts}
    </p>
  );
}

/* ── devops: 터미널 패널 — 다크 배경 + $ 프롬프트 + 출력 수치 칩 ── */
function TerminalPanel({ label, text, mets, accent, index }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#0e1626]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tint(accent, 0.45) }} />
        <span className="font-mono text-[11.5px] text-white/40">ops/{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="p-5">
        <p className="font-mono text-[12px] font-bold" style={{ color: tint(accent, 0.45) }}>$ {label}</p>
        <div className="mt-2.5"><HighlightedText text={text} color={tint(accent, 0.55)} mono dark /></div>
        {mets.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
            {mets.map((m, i) => (
              <span key={i} className="rounded-md px-2.5 py-1 font-mono text-[12px] font-bold" style={{ color: '#76ffb5', backgroundColor: 'rgba(255,255,255,0.08)' }}>▲ {m}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── aiml: 모델 카드 — 그라데이션 프레임 + 모노 메트릭 뱃지 ── */
function ModelCardPanel({ label, text, mets, accent, index }) {
  return (
    <div className="rounded-2xl p-[1.5px]" style={{ background: `linear-gradient(120deg, ${accent}, ${tint(accent, 0.35)} 60%, ${tint(accent, 0.65)})` }}>
      <div className="rounded-[14px] bg-white p-5">
        <p className="font-mono text-[11.5px] font-bold" style={{ color: accent }}>
          <span className="mr-1.5 rounded px-1.5 py-0.5" style={{ backgroundColor: tint(accent, 0.92) }}>{`§${index + 1}`}</span>{label}
        </p>
        <div className="mt-2.5"><HighlightedText text={text} color={accent} /></div>
        {mets.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mets.map((m, i) => (
              <span key={i} className="rounded-md border px-2 py-1 font-mono text-[11.5px] font-black" style={{ borderColor: tint(accent, 0.55), color: accent, backgroundColor: tint(accent, 0.95) }}>{m}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── da: 분석 리포트 — 룰드 라인 + 우측 빅넘버 스탯 레일 ── */
function ReportPanel({ label, subtitle, text, mets, accent, index }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white" style={{ borderTopWidth: 3, borderTopColor: accent }}>
      <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="p-5">
          <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.16em] text-bluewood-400">
            <span style={{ color: accent }}>FIG {index + 1}.</span> {label}
          </p>
          {subtitle && <p className="mt-0.5 text-[12px] text-bluewood-300">{subtitle}</p>}
          <div className="mt-2.5"><HighlightedText text={text} color={accent} /></div>
        </div>
        {mets.length > 0 && (
          <div className="flex flex-row gap-5 border-t border-surface-100 px-5 py-4 sm:w-[150px] sm:flex-col sm:justify-center sm:border-l sm:border-t-0">
            {mets.slice(0, 2).map((m, i) => (
              <div key={i}>
                <p className="font-mono text-[20px] font-black leading-none tracking-tight" style={{ color: accent }}>{m}</p>
                <p className="mt-1 font-mono text-[9.5px] uppercase tracking-wide text-bluewood-300">observed</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── marketer: 캠페인 보드 — 액센트 그라데이션 엣지 + 히어로 넘버 ── */
function CampaignPanel({ label, text, mets, accent, index }) {
  const [top, ...rest] = mets;
  return (
    <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: tint(accent, 0.85) }}>
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${tint(accent, 0.5)})` }} />
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>MOVE {String(index + 1).padStart(2, '0')} — {label}</p>
          <div className="mt-2.5"><HighlightedText text={text} color={accent} /></div>
          {rest.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {rest.map((m, i) => (
                <span key={i} className="rounded-full px-2.5 py-1 text-[11.5px] font-bold text-white" style={{ background: `linear-gradient(120deg, ${accent}, ${tint(accent, 0.35)})` }}>{m}</span>
              ))}
            </div>
          )}
        </div>
        {top && (
          <div className="flex-shrink-0 rounded-2xl px-5 py-4 text-center" style={{ backgroundColor: tint(accent, 0.94) }}>
            <p className="text-[26px] font-black leading-none tracking-tight" style={{ color: accent }}>{top}</p>
            <p className="mt-1.5 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: tint(accent, 0.55) }}>KEY RESULT</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── sales: 딜 시트 — 장부 스타일 + 우측 금액 콜아웃 ── */
function DealSheetPanel({ label, text, mets, accent, index }) {
  const money = mets.find(m => /억|만\s?원|원|ARR|MRR/i.test(m)) || mets[0];
  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl border border-surface-200 bg-white">
      <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: accent }} />
      <div className="min-w-0 flex-1 p-5">
        <p className="text-[11.5px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>LEDGER {String(index + 1).padStart(2, '0')} · {label}</p>
        <div className="mt-2.5"><HighlightedText text={text} color={accent} /></div>
      </div>
      {money && (
        <div className="hidden flex-shrink-0 flex-col items-end justify-center gap-1 border-l border-dashed border-surface-300 px-5 sm:flex" style={{ backgroundColor: tint(accent, 0.96) }}>
          <p className="font-mono text-[22px] font-black tracking-tight" style={{ color: accent }}>{money}</p>
          <p className="text-[9.5px] font-bold uppercase tracking-wide text-bluewood-300">booked</p>
        </div>
      )}
    </div>
  );
}

/* ── hr: 피플 패널 — 웜 톤 + 스탯 필 ── */
function PeoplePanel({ label, text, mets, accent, index }) {
  return (
    <div className="rounded-2xl border border-surface-200 p-5" style={{ background: `linear-gradient(135deg, ${tint(accent, 0.95)}, #ffffff)` }}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-black text-white" style={{ backgroundColor: accent }}>{index + 1}</span>
        <p className="text-[13.5px] font-extrabold text-bluewood-900">{label}</p>
      </div>
      <div className="mt-2.5 pl-[38px]"><HighlightedText text={text} color={accent} /></div>
      {mets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 pl-[38px]">
          {mets.map((m, i) => (
            <span key={i} className="rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-[13px] font-black" style={{ color: accent }}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── pm: 전략 브리프 — 초대형 인덱스 + 인디고 결론 스트립 ── */
function BriefPanel({ label, text, mets, accent, index }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-surface-200 bg-white p-5 pl-6">
      <span className="pointer-events-none absolute -right-2 -top-5 select-none text-[84px] font-black leading-none" style={{ color: tint(accent, 0.93) }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="relative">
        <p className="text-[11.5px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>BRIEF · {label}</p>
        <div className="mt-2.5 max-w-3xl"><HighlightedText text={text} color={accent} /></div>
        {mets.length > 0 && (
          <div className="mt-3.5 inline-flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl px-4 py-2.5" style={{ backgroundColor: tint(accent, 0.94) }}>
            {mets.map((m, i) => (
              <span key={i} className="text-[15px] font-black tracking-tight" style={{ color: accent }}>{m}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── designer: 케이스 스프레드 — 워터마크 넘버 + 넉넉한 여백 + 핑크 언더라인 ── */
function SpreadPanel({ label, text, mets, accent, index }) {
  return (
    <div className="relative py-2 pl-14 sm:pl-20">
      <span className="pointer-events-none absolute left-0 top-0 select-none text-[56px] sm:text-[72px] font-black leading-none" style={{ WebkitTextStroke: `1.5px ${tint(accent, 0.55)}`, color: 'transparent' }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <p className="inline-block border-b-[3px] pb-1 text-[16px] font-black tracking-tight text-bluewood-900" style={{ borderColor: accent }}>{label}</p>
      <div className="mt-3 max-w-2xl"><HighlightedText text={text} color={accent} /></div>
      {mets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-4">
          {mets.map((m, i) => (
            <span key={i} className="text-[19px] font-black tracking-tight" style={{ color: accent }}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const PANELS = {
  devops: TerminalPanel, aiml: ModelCardPanel, da: ReportPanel, marketer: CampaignPanel,
  sales: DealSheetPanel, hr: PeoplePanel, pm: BriefPanel, designer: SpreadPanel,
};

export default function JobSectionPanel({ job, index, label, subtitle, text, accent }) {
  const Panel = PANELS[job];
  if (!Panel) return null;
  const mets = extractMetricPhrases(text, 3);
  return <Panel label={label} subtitle={subtitle} text={text} mets={mets} accent={accent} index={index} />;
}
export const hasJobSectionPanel = (job) => Boolean(PANELS[job]);
