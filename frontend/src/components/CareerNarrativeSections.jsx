/**
 * CareerNarrativeSections — 대시보드의 "나를 알아가는" 영역.
 *
 * 예전에는 10개 행이 전부 같은 모양(좌 라벨 / 우 내용 + 얇은 선)이라
 * 정보는 다 있는데 명세서처럼 읽혀서 눈이 머물 곳이 없었다.
 * 지금은 (1) 요약 히어로 → (2) 3개 장(章) → (3) 내용 성격에 맞는 서로 다른 카드
 * 순으로, 훑을 때 리듬이 생기도록 구성한다.
 *
 * 데이터가 없는 섹션은 렌더하지 않는다 — 빈 껍데기가 쌓이면 오히려 산만해진다.
 */
import { Quote, TrendingUp, ArrowRight, ShieldCheck, Sparkles, Layers } from 'lucide-react';
import {
  buildIdentitySentences, buildPrinciples, buildTurningPoints, buildCompetencyGrowth,
  buildDecisionCriteria, buildStrengthGaps, buildEvidenceHealth, buildProblemKinds,
  buildDensity, buildRevisionActivity,
} from '../utils/careerNarrative';

/* ── 장(章) 헤더 — 큰 숫자를 배경 삼아 구간 전환을 분명히 ── */
const CHAPTER_TONE = {
  navy:      { num: 'text-primary-100',   label: 'text-primary-600',   rule: 'bg-primary-200' },
  caribbean: { num: 'text-caribbean-100', label: 'text-caribbean-700', rule: 'bg-caribbean-200' },
  amber:     { num: 'text-amber-100',     label: 'text-amber-600',     rule: 'bg-amber-200' },
};

function Chapter({ numeral, label, caption, tone = 'navy' }) {
  const t = CHAPTER_TONE[tone];
  return (
    <div className="relative mt-12 mb-5 first:mt-0">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -left-1 -top-6 select-none font-black leading-none ${t.num}`}
        style={{ fontSize: '76px' }}
      >
        {numeral}
      </span>
      <div className="relative pl-1">
        <p className={`text-[12px] font-black uppercase tracking-[0.18em] ${t.label}`}>{label}</p>
        <p className="mt-1 text-[13.5px] font-medium text-bluewood-500">{caption}</p>
        <span className={`mt-3 block h-[3px] w-10 rounded-full ${t.rule}`} />
      </div>
    </div>
  );
}

/* ── 카드 — 모든 블록의 공통 껍데기 ── */
function Card({ title, desc, icon: Icon, children, className = '', accent = 'default' }) {
  if (!children) return null;
  const ring = accent === 'primary' ? 'border-primary-200 bg-primary-50/30'
    : accent === 'good' ? 'border-caribbean-200 bg-caribbean-50/30'
    : accent === 'warn' ? 'border-amber-200 bg-amber-50/30'
    : 'border-surface-200 bg-white';
  return (
    <section className={`rounded-2xl border ${ring} p-5 transition-shadow hover:shadow-[0_4px_20px_rgba(0,47,108,0.06)] ${className}`}>
      <div className="mb-3.5 flex items-start gap-2.5">
        {Icon && (
          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white text-primary-500 shadow-sm">
            <Icon size={15} />
          </span>
        )}
        <div className="min-w-0">
          <h4 className="text-[14.5px] font-extrabold leading-snug text-bluewood-900">{title}</h4>
          {desc && <p className="mt-0.5 text-[12px] leading-relaxed text-bluewood-400">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const Chip = ({ children, tone = 'default' }) => (
  <span className={`inline-block rounded-lg px-2.5 py-1 text-[12.5px] font-semibold ${
    tone === 'primary' ? 'bg-primary-500 text-white'
      : tone === 'good' ? 'bg-caribbean-50 text-caribbean-700 ring-1 ring-caribbean-200'
      : tone === 'warn' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
      : 'bg-surface-100 text-bluewood-600'
  }`}>{children}</span>
);

const Empty = ({ children }) => (
  <p className="rounded-xl border border-dashed border-surface-300 bg-surface-50/50 px-3.5 py-3 text-[12.5px] leading-relaxed text-bluewood-400">
    {children}
  </p>
);

/* 패턴 확신도 — 색으로 단계를 읽히게 */
const STATUS_STYLE = {
  '검증됨':   'bg-caribbean-500',
  '관찰 중':  'bg-primary-400',
  '가설':     'bg-bluewood-200',
};

export default function CareerNarrativeSections({ experiences = [], targetCompetencies = [] }) {
  if (!experiences.length) return null;

  const identity = buildIdentitySentences(experiences);
  const principles = buildPrinciples(experiences);
  const turns = buildTurningPoints(experiences);
  const growth = buildCompetencyGrowth(experiences);
  const criteria = buildDecisionCriteria(experiences);
  const gaps = buildStrengthGaps(experiences, targetCompetencies);
  const evidence = buildEvidenceHealth(experiences);
  const kinds = buildProblemKinds(experiences);
  const density = buildDensity(experiences);
  const revision = buildRevisionActivity(experiences);

  const hasAny = identity.total || principles.length || turns.length || growth.length
    || criteria.length || evidence.total || kinds.length;
  if (!hasAny) return null;

  const verifiedPatterns = identity.patterns.filter(p => p.status === '검증됨').length;

  // 히어로에 올릴 요약 지표 — 값이 있는 것만
  const stats = [
    { label: '정리한 경험', value: experiences.length, unit: '개' },
    growth.length ? { label: '누적 역량', value: growth.length, unit: '개' } : null,
    verifiedPatterns ? { label: '검증된 패턴', value: verifiedPatterns, unit: '개' } : null,
    evidence.total ? { label: '증거 확보', value: evidence.securedPct, unit: '%' } : null,
  ].filter(Boolean);

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

      {/* ══════ 히어로 ══════ */}
      <div className="relative overflow-hidden bg-primary-500 px-7 py-8 sm:px-9 sm:py-10">
        {/* 배경 장식 — 은은한 원형 글로우 */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: 'radial-gradient(circle at 82% 15%, #ffffff 0%, transparent 45%), radial-gradient(circle at 8% 95%, #87add5 0%, transparent 50%)' }} />
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-2 top-6 h-28 w-28 rounded-full border border-white/10" />

        <div className="relative">
          <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.22em] text-primary-200">
            <Sparkles size={13} /> Who I Am
          </p>
          <h3 className="mt-2.5 max-w-xl text-[26px] font-extrabold leading-[1.25] tracking-[-0.02em] text-white sm:text-[30px]"
            style={{ wordBreak: 'keep-all' }}>
            경험이 쌓일수록<br className="hidden sm:block" /> 선명해지는 것들
          </h3>
          <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-primary-100" style={{ wordBreak: 'keep-all' }}>
            경험 하나는 취향이지만, 여러 경험에서 반복되면 패턴입니다.
            아래는 지금까지 정리한 {experiences.length}개에서 뽑아낸 것들이에요.
          </p>

          {/* 요약 지표 */}
          <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/15 pt-5">
            {stats.map(s => (
              <div key={s.label}>
                <dt className="text-[11.5px] font-semibold tracking-wide text-primary-200">{s.label}</dt>
                <dd className="mt-0.5 flex items-baseline gap-0.5 text-white">
                  <span className="text-[26px] font-extrabold leading-none tabular-nums">{s.value}</span>
                  <span className="text-[13px] font-bold text-primary-200">{s.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ══════ 본문 ══════ */}
      <div className="px-6 pb-9 pt-2 sm:px-8">

        {/* ─────── Ⅰ. 나는 어떤 사람인가 ─────── */}
        <Chapter numeral="Ⅰ" tone="navy"
          label="나는 어떤 사람인가"
          caption="반복되는 행동과 판단에서 드러나는 것" />

        {/* 대표 문장 — 이 섹션의 주인공이므로 가장 크게 */}
        {(identity.sentences.length || identity.patterns.length) ? (
          <section className="relative overflow-hidden rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50/80 to-white p-6">
            <Quote aria-hidden="true" size={78} strokeWidth={1}
              className="pointer-events-none absolute -right-3 -top-3 text-primary-100" />
            <div className="relative">
              <p className="mb-4 text-[12px] font-black uppercase tracking-[0.16em] text-primary-400">
                나를 보여주는 한 문장
              </p>

              <div className="space-y-4">
                {identity.sentences.map((s, i) => (
                  <blockquote key={i}>
                    <p className="text-[17px] font-bold leading-[1.6] text-bluewood-900" style={{ wordBreak: 'keep-all' }}>
                      “{s.sentence}”
                    </p>
                    <footer className="mt-1.5 text-[12px] font-medium text-bluewood-400">— {s.from}</footer>
                  </blockquote>
                ))}
              </div>

              {identity.patterns.length > 0 && (
                <div className="mt-5 border-t border-primary-100 pt-4">
                  <p className="mb-2.5 text-[12px] font-bold text-bluewood-500">반복 관찰된 행동 패턴</p>
                  <div className="flex flex-wrap gap-2">
                    {identity.patterns.map(p => (
                      <span key={p.label}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-bluewood-700 shadow-sm ring-1 ring-surface-200">
                        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLE[p.status] || 'bg-bluewood-200'}`} />
                        {p.label}
                        <span className="text-[11.5px] font-bold text-bluewood-300">{p.status} · {p.count}회</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <Empty>경험을 정리하면 여기에 나를 설명하는 문장이 쌓입니다.</Empty>
        )}

        {/* 원칙 / 기준 / 문제 유형 */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="나의 판단 원칙" desc="같은 상황에서 다시 쓰게 된 기준" icon={ShieldCheck}>
            {principles.length ? (
              <ol className="space-y-2.5">
                {principles.map((p, i) => (
                  <li key={i} className="flex gap-3 rounded-xl bg-surface-50/70 px-3.5 py-3">
                    <span aria-hidden="true"
                      className="mt-px flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-primary-500 font-mono text-[11px] font-black text-white">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium leading-relaxed text-bluewood-800" style={{ wordBreak: 'keep-all' }}>
                        {p.text}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-bluewood-300">{p.from}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : <Empty>판단이 바뀐 경험을 정리하면 원칙이 모입니다.</Empty>}
          </Card>

          <div className="grid gap-4">
            <Card title="반복되는 선택 기준" desc="무엇을 우선하는 사람인가" icon={Layers}>
              {criteria.length ? (
                <div className="space-y-2.5">
                  {criteria.map((c, i) => (
                    <div key={c.label} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-[12.5px] font-medium text-bluewood-600" title={c.label}>
                        {c.label}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-100">
                        <div
                          className={`h-full rounded-full ${i === 0 ? 'bg-primary-500' : 'bg-primary-300'}`}
                          style={{ width: `${Math.max(8, (c.count / criteria[0].count) * 100)}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right font-mono text-[12px] font-bold text-bluewood-400">{c.count}</span>
                    </div>
                  ))}
                </div>
              ) : <Empty>의사결정 기준이 담긴 경험이 아직 없어요.</Empty>}
            </Card>

            <Card title="내가 다루는 문제" desc="어떤 종류의 문제에 끌리는가">
              {kinds.length ? (
                <div className="flex flex-wrap gap-2">
                  {kinds.map((k, i) => (
                    <Chip key={k.label} tone={i === 0 ? 'primary' : 'default'}>
                      {k.label} <b className="ml-0.5 tabular-nums">{k.count}</b>
                    </Chip>
                  ))}
                </div>
              ) : <Empty>문제 정의가 담긴 경험이 필요해요.</Empty>}
            </Card>
          </div>
        </div>

        {/* ─────── Ⅱ. 어떻게 성장했나 ─────── */}
        <Chapter numeral="Ⅱ" tone="caribbean"
          label="어떻게 성장했나"
          caption="시간에 따라 달라진 것" />

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 역량 궤적 — 세로 타임라인 */}
          <Card title="역량 확장 궤적" desc="새 역량이 처음 등장한 시점" icon={TrendingUp}>
            {growth.length ? (
              <ol className="relative space-y-3.5 pl-1">
                <span aria-hidden="true" className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-surface-200" />
                {growth.map(g => (
                  <li key={g.label} className="relative pl-6">
                    <span aria-hidden="true"
                      className="absolute left-0 top-[5px] h-[11px] w-[11px] rounded-full border-2 border-white bg-caribbean-500 shadow-sm" />
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-mono text-[11.5px] font-bold text-bluewood-300">{g.when}</span>
                      <span className="text-[13.5px] font-bold text-bluewood-800">{g.label}</span>
                      <span className="rounded bg-caribbean-50 px-1.5 py-px text-[11px] font-bold text-caribbean-700">
                        누적 {g.cumulative}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-bluewood-300" title={g.from}>{g.from}</p>
                  </li>
                ))}
              </ol>
            ) : <Empty>역량 태그와 작성일이 있어야 궤적이 그려집니다.</Empty>}
          </Card>

          {/* 생각이 바뀐 순간 — 그때 → 지금 대비 */}
          <Card title="생각이 바뀐 순간" desc="면접에서 가장 깊게 파고드는 지점">
            {turns.length ? (
              <div className="space-y-3">
                {turns.map((t, i) => (
                  <div key={i} className="rounded-xl border border-surface-200 bg-surface-50/50 p-3.5">
                    <div className="flex items-start gap-2">
                      <span className="mt-px w-9 flex-shrink-0 rounded bg-bluewood-100 py-0.5 text-center text-[11px] font-black text-bluewood-500">
                        그때
                      </span>
                      <p className="min-w-0 text-[13px] leading-relaxed text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
                        {t.before}
                      </p>
                    </div>
                    {t.after && (
                      <>
                        <ArrowRight aria-hidden="true" size={13} className="my-1.5 ml-2.5 rotate-90 text-primary-300" />
                        <div className="flex items-start gap-2">
                          <span className="mt-px w-9 flex-shrink-0 rounded bg-primary-500 py-0.5 text-center text-[11px] font-black text-white">
                            지금
                          </span>
                          <p className="min-w-0 text-[13px] font-medium leading-relaxed text-bluewood-800" style={{ wordBreak: 'keep-all' }}>
                            {t.after}
                          </p>
                        </div>
                      </>
                    )}
                    <p className="mt-2 truncate text-[11.5px] text-bluewood-300" title={t.from}>{t.from}</p>
                  </div>
                ))}
              </div>
            ) : <Empty>솔직 회고를 채우면 여기에 모입니다.</Empty>}
          </Card>

          <Card title="정리 밀도" desc="몰입한 시기와 비어 있는 시기">
            {density.rows.length ? (
              <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
                {density.rows.map(r => (
                  <div key={r.label} className="flex w-10 shrink-0 flex-col items-center gap-1.5"
                    title={`${r.label} · ${r.count}개`}>
                    <span className="text-[11px] font-bold tabular-nums text-bluewood-400">{r.count}</span>
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-primary-500 to-primary-300"
                      style={{ height: `${Math.max(8, (r.count / density.max) * 64)}px` }}
                    />
                    <span className="text-[10.5px] text-bluewood-300">{r.label.slice(2)}</span>
                  </div>
                ))}
              </div>
            ) : <Empty>작성일이 기록된 경험이 필요해요.</Empty>}
          </Card>

          <Card title="다시 손본 경험" desc="되돌아본 경험일수록 서술이 두꺼워집니다">
            {revision.rows.length ? (
              <div>
                <p className="mb-2.5 rounded-lg bg-surface-50 px-3 py-2 text-[12.5px] text-bluewood-500">
                  전체 {revision.total}개 중{' '}
                  <strong className="text-[14px] font-extrabold text-primary-600 tabular-nums">{revision.revisited}개</strong>
                  를 작성 후 다시 수정했어요.
                </p>
                <ul className="space-y-1.5">
                  {revision.rows.map((r, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                      <span className="min-w-0 truncate text-bluewood-700" title={r.title}>{r.title}</span>
                      <span className="shrink-0 font-mono text-[11.5px] text-bluewood-300">+{r.days}일</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <Empty>아직 다시 손본 경험이 없어요. 시간이 지난 뒤 다시 보면 다르게 보입니다.</Empty>}
          </Card>
        </div>

        {/* ─────── Ⅲ. 무엇을 보완할까 ─────── */}
        <Chapter numeral="Ⅲ" tone="amber"
          label="무엇을 보완할까"
          caption="다음에 채우면 좋은 것" />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="강점과 공백" desc="목표 직군이 요구하는 역량 대비">
            {targetCompetencies.length ? (
              <div className="space-y-3.5">
                {gaps.have.length > 0 && (
                  <div className="rounded-xl border border-caribbean-200 bg-caribbean-50/40 p-3.5">
                    <p className="mb-2 flex items-center gap-1.5 text-[12px] font-black text-caribbean-700">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-caribbean-500" />
                      갖춘 역량 {gaps.have.length}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {gaps.have.map(c => <Chip key={c} tone="good">{c}</Chip>)}
                    </div>
                  </div>
                )}
                {gaps.missing.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5">
                    <p className="mb-2 flex items-center gap-1.5 text-[12px] font-black text-amber-600">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      아직 비어 있는 역량 {gaps.missing.length}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {gaps.missing.map(c => <Chip key={c} tone="warn">{c}</Chip>)}
                    </div>
                    <p className="mt-2.5 text-[12px] leading-relaxed text-bluewood-500">
                      이 역량이 드러나는 경험을 추가하면 목표 직군과의 간극이 줄어요.
                    </p>
                  </div>
                )}
              </div>
            ) : <Empty>추천 진로가 정해지면 비교해서 보여드릴게요.</Empty>}
          </Card>

          <Card title="증거 보유 현황" desc="주장 옆에 붙일 자료가 있는지">
            {evidence.total ? (
              <div className="space-y-3.5">
                {/* 큰 숫자 + 진행 바 */}
                <div className="flex items-end gap-3">
                  <p className="flex items-baseline gap-0.5">
                    <span className="text-[34px] font-extrabold leading-none tabular-nums text-caribbean-700">
                      {evidence.securedPct}
                    </span>
                    <span className="text-[15px] font-bold text-caribbean-600">%</span>
                  </p>
                  <p className="pb-1 text-[12.5px] font-medium text-bluewood-400">증거 확보</p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-caribbean-500 to-caribbean-600 transition-[width] duration-500"
                    style={{ width: `${evidence.securedPct}%` }} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Chip tone="good">확보됨 {evidence.counts['확보됨']}</Chip>
                  <Chip tone="warn">확인 필요 {evidence.counts['확인 필요']}</Chip>
                  <Chip>추가 필요 {evidence.counts['추가 필요']}</Chip>
                </div>

                {evidence.bare.length > 0 && (
                  <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-3.5 py-2.5">
                    <p className="text-[12px] font-bold text-amber-700">증거가 하나도 없는 경험</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-bluewood-500">
                      {evidence.bare.join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            ) : <Empty>경험에 증거 자료를 연결하면 보유율이 계산됩니다.</Empty>}
          </Card>
        </div>
      </div>
    </div>
  );
}
