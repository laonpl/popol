/**
 * CareerNarrativeSections — 대시보드의 "나를 알아가는" 영역.
 *
 * 카드 남발 대신 얇은 선으로만 구분한다(기존 대시보드 톤 유지).
 * 좌측 라벨 / 우측 내용의 2열 구조로, 훑을 때 제목만 읽어도 흐름이 잡히게 했다.
 * 데이터가 없는 섹션은 렌더하지 않는다 — 빈 껍데기가 쌓이면 오히려 산만해진다.
 */
import {
  buildIdentitySentences, buildPrinciples, buildTurningPoints, buildCompetencyGrowth,
  buildDecisionCriteria, buildStrengthGaps, buildEvidenceHealth, buildProblemKinds,
  buildDensity, buildRevisionActivity,
} from '../utils/careerNarrative';

/* 한 섹션 = 좌측 번호·제목 / 우측 내용, 아래로 얇은 선 */
function Row({ n, title, desc, children }) {
  if (!children) return null;
  return (
    <section className="grid gap-3 border-t border-surface-200 py-7 md:grid-cols-[220px_1fr] md:gap-8">
      <div>
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] font-black text-bluewood-200">{String(n).padStart(2, '0')}</span>
          <span className="text-[14px] font-extrabold text-bluewood-900">{title}</span>
        </p>
        {desc && <p className="mt-1 text-[11.5px] leading-relaxed text-bluewood-400">{desc}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/* 그룹 헤더 — 세 덩어리로 나눠 스크롤 중 위치를 잃지 않게 */
function GroupHeading({ label, caption }) {
  return (
    <div className="pt-10 pb-1">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary-500">{label}</p>
      <p className="mt-1 text-[13px] text-bluewood-400">{caption}</p>
    </div>
  );
}

const Chip = ({ children, tone = 'default' }) => (
  <span className={`inline-block rounded-md px-2 py-1 text-[12px] font-semibold ${
    tone === 'primary' ? 'bg-primary-50 text-primary-700'
      : tone === 'good' ? 'bg-caribbean-50 text-caribbean-700'
      : tone === 'warn' ? 'bg-amber-50 text-amber-700'
      : 'bg-surface-100 text-bluewood-600'
  }`}>{children}</span>
);

const Empty = ({ children }) => <p className="text-[12.5px] text-bluewood-300">{children}</p>;

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

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white px-8 py-7 shadow-sm">
      <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-primary-400">Who I Am</p>
      <h3 className="mt-1.5 text-[24px] font-extrabold leading-tight text-gray-900">경험이 쌓일수록 선명해지는 것들</h3>
      <p className="mt-2 text-[13.5px] text-bluewood-500">
        경험 하나는 취향이지만, 여러 경험에서 반복되면 패턴입니다. 아래는 지금까지 정리한 {experiences.length}개에서 뽑아낸 것들이에요.
      </p>

      <GroupHeading label="Ⅰ. 나는 어떤 사람인가" caption="반복되는 행동과 판단에서 드러나는 것" />

      <Row n={1} title="나를 보여주는 한 문장" desc="여러 경험에서 반복될수록 확정됩니다">
        {identity.sentences.length || identity.patterns.length ? (
          <div className="space-y-3">
            {identity.sentences.map((s, i) => (
              <blockquote key={i} className="border-l-2 border-primary-300 pl-3">
                <p className="text-[14px] font-semibold leading-relaxed text-bluewood-800">“{s.sentence}”</p>
                <p className="mt-0.5 text-[11px] text-bluewood-300">{s.from}</p>
              </blockquote>
            ))}
            {identity.patterns.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {identity.patterns.map(p => (
                  <span key={p.label} className="inline-flex items-center gap-1.5 rounded-md bg-surface-100 px-2 py-1 text-[12px] text-bluewood-600">
                    {p.label}
                    <span className={`text-[10px] font-black ${
                      p.status === '검증됨' ? 'text-caribbean-700' : p.status === '관찰 중' ? 'text-primary-600' : 'text-bluewood-300'
                    }`}>{p.status} · {p.count}회</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : <Empty>경험을 정리하면 여기에 문장이 쌓입니다.</Empty>}
      </Row>

      <Row n={2} title="나의 판단 원칙" desc="같은 상황에서 다시 쓰게 된 기준">
        {principles.length ? (
          <ol className="space-y-2">
            {principles.map((p, i) => (
              <li key={i} className="text-[13.5px] leading-relaxed text-bluewood-700">
                <span className="mr-2 font-mono text-[11px] font-black text-primary-400">{String(i + 1).padStart(2, '0')}</span>
                {p.text}
                <span className="ml-1.5 text-[11px] text-bluewood-300">— {p.from}</span>
              </li>
            ))}
          </ol>
        ) : <Empty>판단이 바뀐 경험을 정리하면 원칙이 모입니다.</Empty>}
      </Row>

      <Row n={3} title="반복되는 선택 기준" desc="무엇을 우선하는 사람인가">
        {criteria.length ? (
          <div className="space-y-2">
            {criteria.map(c => (
              <div key={c.label} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-[12.5px] text-bluewood-600" title={c.label}>{c.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-100">
                  <div className="h-full rounded-full bg-primary-500" style={{ width: `${(c.count / criteria[0].count) * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right font-mono text-[11.5px] font-bold text-bluewood-400">{c.count}</span>
              </div>
            ))}
          </div>
        ) : <Empty>의사결정 기준이 담긴 경험이 아직 없어요.</Empty>}
      </Row>

      <Row n={4} title="내가 다루는 문제" desc="어떤 종류의 문제에 끌리는가">
        {kinds.length ? (
          <div className="flex flex-wrap gap-1.5">
            {kinds.map(k => (
              <Chip key={k.label} tone={k === kinds[0] ? 'primary' : 'default'}>{k.label} <b className="ml-0.5">{k.count}</b></Chip>
            ))}
          </div>
        ) : <Empty>문제 정의가 담긴 경험이 필요해요.</Empty>}
      </Row>

      <GroupHeading label="Ⅱ. 어떻게 성장했나" caption="시간에 따라 달라진 것" />

      <Row n={5} title="역량 확장 궤적" desc="새 역량이 처음 등장한 시점">
        {growth.length ? (
          <div className="space-y-1.5">
            {growth.map((g, i) => (
              <div key={g.label} className="flex items-baseline gap-3 text-[13px]">
                <span className="w-14 shrink-0 font-mono text-[11px] text-bluewood-300">{g.when}</span>
                <span className="font-semibold text-bluewood-800">{g.label}</span>
                <span className="text-[11px] text-bluewood-300">누적 {g.cumulative}개 · {g.from}</span>
              </div>
            ))}
          </div>
        ) : <Empty>역량 태그와 작성일이 있어야 궤적이 그려집니다.</Empty>}
      </Row>

      <Row n={6} title="생각이 바뀐 순간" desc="면접에서 가장 깊게 파고드는 지점">
        {turns.length ? (
          <div className="space-y-3.5">
            {turns.map((t, i) => (
              <div key={i}>
                <p className="text-[13px] leading-relaxed text-bluewood-500"><span className="font-bold text-bluewood-400">그때 </span>{t.before}</p>
                {t.after && <p className="mt-0.5 text-[13px] leading-relaxed text-bluewood-800"><span className="font-bold text-primary-600">지금 </span>{t.after}</p>}
                <p className="mt-0.5 text-[11px] text-bluewood-300">{t.from}</p>
              </div>
            ))}
          </div>
        ) : <Empty>솔직 회고를 채우면 여기에 모입니다.</Empty>}
      </Row>

      <Row n={7} title="정리 밀도" desc="몰입한 시기와 비어 있는 시기">
        {density.rows.length ? (
          <div className="flex items-end gap-1 overflow-x-auto pb-1">
            {density.rows.map(r => (
              <div key={r.label} className="flex w-9 shrink-0 flex-col items-center gap-1" title={`${r.label} · ${r.count}개`}>
                <div className="w-full rounded-t bg-primary-500" style={{ height: `${Math.max(6, (r.count / density.max) * 56)}px` }} />
                <span className="text-[9.5px] text-bluewood-300">{r.label.slice(2)}</span>
              </div>
            ))}
          </div>
        ) : <Empty>작성일이 기록된 경험이 필요해요.</Empty>}
      </Row>

      <Row n={8} title="다시 손본 경험" desc="되돌아본 경험일수록 서술이 두꺼워집니다">
        {revision.rows.length ? (
          <div className="space-y-1.5">
            <p className="text-[12.5px] text-bluewood-500">
              전체 {revision.total}개 중 <strong className="text-bluewood-800">{revision.revisited}개</strong>를 작성 후 다시 수정했어요.
            </p>
            {revision.rows.map((r, i) => (
              <p key={i} className="text-[12.5px] text-bluewood-600">
                {r.title} <span className="text-[11px] text-bluewood-300">· 작성 {r.days}일 뒤 보완</span>
              </p>
            ))}
          </div>
        ) : <Empty>아직 다시 손본 경험이 없어요. 시간이 지난 뒤 다시 보면 다르게 보입니다.</Empty>}
      </Row>

      <GroupHeading label="Ⅲ. 무엇을 보완할까" caption="다음에 채우면 좋은 것" />

      <Row n={9} title="강점과 공백" desc="목표 직군이 요구하는 역량 대비">
        {targetCompetencies.length ? (
          <div className="space-y-3">
            {gaps.have.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-bold text-caribbean-700">갖춘 역량</p>
                <div className="flex flex-wrap gap-1.5">{gaps.have.map(c => <Chip key={c} tone="good">{c}</Chip>)}</div>
              </div>
            )}
            {gaps.missing.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-bold text-amber-600">아직 비어 있는 역량</p>
                <div className="flex flex-wrap gap-1.5">{gaps.missing.map(c => <Chip key={c} tone="warn">{c}</Chip>)}</div>
                <p className="mt-1.5 text-[11.5px] text-bluewood-400">이 역량이 드러나는 경험을 추가하면 목표 직군과의 간극이 줄어요.</p>
              </div>
            )}
          </div>
        ) : <Empty>추천 진로가 정해지면 비교해서 보여드릴게요.</Empty>}
      </Row>

      <Row n={10} title="증거 보유 현황" desc="주장 옆에 붙일 자료가 있는지">
        {evidence.total ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-100">
                <div className="h-full rounded-full bg-caribbean-600" style={{ width: `${evidence.securedPct}%` }} />
              </div>
              <span className="shrink-0 text-[12.5px] font-bold text-bluewood-700">{evidence.securedPct}% 확보</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="good">확보됨 {evidence.counts['확보됨']}</Chip>
              <Chip tone="warn">확인 필요 {evidence.counts['확인 필요']}</Chip>
              <Chip>추가 필요 {evidence.counts['추가 필요']}</Chip>
            </div>
            {evidence.bare.length > 0 && (
              <p className="text-[11.5px] leading-relaxed text-bluewood-400">
                증거가 하나도 없는 경험 · {evidence.bare.join(' / ')}
              </p>
            )}
          </div>
        ) : <Empty>경험에 증거 자료를 연결하면 보유율이 계산됩니다.</Empty>}
      </Row>
    </div>
  );
}
