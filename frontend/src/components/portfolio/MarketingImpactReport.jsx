import { ArrowRight } from 'lucide-react';
import { MARKETER_STAGE_LABELS, METRIC_KINDS } from '../../utils/marketerEvidence';
import { roleReportCounts } from '../../utils/roleImpactReport';
import { Source } from './MarketerWorkProductBlocks';
import RoleArtifactStudio from './RoleArtifactStudio';
import { ReportChapter, ReportField, ReportEmpty, ReportStats, ReportJump } from './ImpactReportParts';
import { CampaignRouteCanvas, CampaignFunnelGraphic, MetricGraphic, ExperimentStoryboard, ImprovementTrail } from './RoleVisualCanvas';
import './RoleImpactReport.css';

function Detail({ title, children }) {
  return <details className="ir-visual-detail" data-print="true"><summary>{title}</summary><div>{children}</div></details>;
}

export default function MarketingImpactReport({ item, sr, onChange, readOnly, notes, prefix }) {
  const w = item.workProducts;
  const records = dimensions => item.records.filter(row => dimensions.includes(row.dimension));
  const audience = w.audiences[0], positioning = w.positioning[0];
  const primary = item.metrics.find(row => row.actual && row.kind === 'outcome' && ['conversion', 'retention', 'cost'].includes(row.stage))
    || item.metrics.find(row => row.actual && row.kind === 'outcome') || item.metrics.find(row => row.actual);
  const chapter = (key, number, title, subtitle, groups) => ({ id: `${prefix}-${key}`, number, title, subtitle, groups, sr, item, role: 'marketer', onChange: readOnly ? null : onChange });
  return <div className="mir-report visual-report" aria-label="캠페인 실행과 성과 리포트">
    <header className="mir-hero"><div><span>CAMPAIGN / GROWTH CANVAS</span><h2>{item.title}</h2><p>{positioning?.promise || records(['conversion'])[0]?.claim || '타깃 · 소재 · 접점 · 반응을 연결한 기록'}</p></div><div className="mir-impact"><small>{primary ? METRIC_KINDS[primary.kind] : '캠페인 경험'}</small><strong>{primary?.actual || `${w.creatives.length}개 소재 기록`}</strong><b>{primary?.name || '직접 만든 메시지와 실행'}</b>{primary && <span>{[primary.channel, primary.period].filter(Boolean).join(' · ')}</span>}</div></header>
    <ReportStats rows={roleReportCounts(item, 'marketer')} />
    <ReportJump entries={[['strategy', '캠페인 지도'], ['creative', '소재 쇼케이스'], ['activation', '채널 · CRM'], ['measurement', '퍼널 · 임팩트'], ['learning', '실험 · 개선']].map(([key, label]) => [`${prefix}-${key}`, label])} />

    <ReportChapter {...chapter('strategy', '01', '타깃에서 다음 행동까지, 캠페인 지도', '각 채널에 기록한 고객 · 접점 · 다음 행동을 연결합니다. 노드를 선택해 실행을 확인하세요.', ['audiences', 'positioning'])}>
      <CampaignRouteCanvas item={item} />
      {(audience || positioning) && <div className="mir-strategy-strip"><div><small>AUDIENCE · 고객의 행동 장벽</small><h4>{audience?.segment || positioning?.audience}</h4><p>{audience?.barrier || audience?.need}</p></div><ArrowRight size={28} /><div><small>MESSAGE · 전달할 약속</small><h4>{positioning?.promise || audience?.choice}</h4><p>{positioning?.proof || audience?.signal}</p></div></div>}
      <Detail title="타깃 인사이트 · 메시지 전략 · 담당 범위 펼치기">
        {w.audiences.map((row, i) => <article className="mir-extra-audience" key={i}><h4>{row.segment}</h4><dl>{[['signal', '관찰'], ['need', '필요'], ['barrier', '장벽'], ['choice', '선택']].map(([field, label]) => <ReportField key={field} label={label} value={row[field]} />)}</dl><Source row={row} /></article>)}
        {w.positioning.map((row, i) => <article className="mir-extra-audience" key={i}><h4>{row.promise}</h4><dl>{[['audience', '고객'], ['proof', '믿을 근거'], ['difference', '차별점'], ['tone', '표현 · 톤']].map(([field, label]) => <ReportField key={field} label={label} value={row[field]} />)}</dl><Source row={row} /></article>)}
        {notes(records(['conversion', 'targeting']))}
      </Detail>
    </ReportChapter>

    <ReportChapter {...chapter('creative', '02', '내가 만든 소재, 표현의 선택', '원본 작업물을 크게 보고, 소재 버전의 문안과 관찰을 비교합니다.', ['creatives'])}>
      <div className="mir-creative-wall"><RoleArtifactStudio sr={sr} item={item} role="marketer" onChange={onChange} readOnly={readOnly} showcase /></div>
      <div className="mir-copy-ledger">{w.creatives.map((row, i) => <article key={i}><header><span>{String(i + 1).padStart(2, '0')}</span><div><b>{row.variant || `소재 ${i + 1}`}</b><small>{[row.format, MARKETER_STAGE_LABELS[row.stage]].filter(Boolean).join(' · ')}</small></div></header><div className="mir-copy"><small>HOOK · 실제 문안</small><h4>{row.hook || '후킹 문구 미기록'}</h4>{row.message && <p>{row.message}</p>}{row.cta && <div className="mir-cta">CTA <ArrowRight size={12} />{row.cta}</div>}</div><dl><ReportField label="표현 선택 이유" value={row.rationale} /><ReportField label="관찰한 반응" value={row.observation} /></dl><Source row={row} /></article>)}</div>
      {!w.creatives.length && <ReportEmpty>실제 후킹 문구 · 본문 · CTA와 표현 선택 이유를 기록하세요.</ReportEmpty>}
      <Detail title="기존 소재 기획과 표현 기록 펼치기">{notes(records(['creative']))}</Detail>
    </ReportChapter>

    <ReportChapter {...chapter('activation', '03', '채널 운영과 고객의 다음 접점', '콘텐츠의 확장과 CRM의 진입 → 메시지 → 종료 조건을 읽습니다.', ['channels', 'contentSystem', 'crm', 'operations'])}>
      <div className="mir-lifecycle">
        {w.contentSystem.length > 0 && <div className="mir-editorial"><header><h4>콘텐츠 발행 · 배포 · 확장</h4></header>{w.contentSystem.map((row, i) => <article key={i}><h5>{row.pillar}</h5><p>{row.intent}</p><div className="mir-content-flow"><span>{row.format || '형식 미기록'}</span><ArrowRight size={17} /><span>{row.distribution || '배포 미기록'}</span><ArrowRight size={17} /><span>{row.reuse || '확장 미기록'}</span></div>{row.cadence && <p>발행 주기 · {row.cadence}</p>}<Source row={row} /></article>)}</div>}
        {w.crm.length > 0 && <div className="mir-crm"><header><h4>CRM 여정과 고객 보호</h4></header>{w.crm.map((row, i) => <article key={i}><small>{MARKETER_STAGE_LABELS[row.stage]}</small><h5>{row.segment}</h5><ol><li><small>ENTER · 진입</small><p>{row.trigger || '조건 미기록'}</p></li><li><small>SEND · 메시지</small><p>{[row.timing, row.message].filter(Boolean).join(' · ') || '메시지 미기록'}</p></li><li><small>EXIT · 종료</small><p>{row.exit || '조건 미기록'}</p></li></ol>{row.guardrail && <p className="ir-limit">고객 보호 · {row.guardrail}</p>}<Source row={row} /></article>)}</div>}
      </div>
      {!w.contentSystem.length && !w.crm.length && <ReportEmpty>콘텐츠의 배포·확장 구조 또는 CRM 진입·종료 조건을 기록하세요.</ReportEmpty>}
      <Detail title="채널별 집행 조건 · 제작과 협업 기록 펼치기">
        {w.channels.map((row, i) => <article className="mir-extra-audience" key={i}><h4>{row.channel}</h4><dl>{[['purpose', '채널 역할'], ['audience', '고객'], ['budget', '예산'], ['period', '기간'], ['handoff', '다음 접점'], ['rationale', '선택 이유']].map(([field, label]) => <ReportField key={field} label={label} value={row[field]} />)}</dl><Source row={row} /></article>)}
        {w.operations.map((row, i) => <article className="mir-extra-audience" key={i}><h4>{row.deliverable}</h4><dl>{[['stakeholder', '협업 상대'], ['constraint', '제약'], ['myAction', '내 실행 · 조율'], ['agreement', '합의']].map(([field, label]) => <ReportField key={field} label={label} value={row[field]} />)}</dl><Source row={row} /></article>)}
        {notes(records(['activation']))}
      </Detail>
    </ReportChapter>

    <ReportChapter {...chapter('measurement', '04', '고객의 반응, 퍼널과 캠페인 임팩트', '기록된 단계의 실측과 목표를 확인합니다. 고객 반응과 제작량은 각각 표시합니다.', ['measurement'])}>
      <CampaignFunnelGraphic item={item} />
      <div className="mir-metrics">{item.metrics.map((row, i) => <article key={i}><header><small>{METRIC_KINDS[row.kind]}{row.channel ? ` · ${row.channel}` : ''}</small><h4>{row.name}</h4></header><MetricGraphic metric={row} /><p className="ir-measurement">{[row.period, row.population, row.method].filter(Boolean).join(' · ') || '측정 조건 미기록'}</p>{row.reportedValue && <p className="ir-limit">기존 기록 · 원문 미대조: {row.reportedValue}</p>}<Source row={row} />{row.limitation && <p className="ir-limit">{row.limitation}</p>}</article>)}</div>
      <Detail title="측정 정의 · 귀속 조건 · 성과 해석 펼치기">
        {w.measurement.map((row, i) => <article className="mir-extra-audience" key={i}><h4>{row.event}</h4><dl>{[['definition', '집계 · 분모'], ['sourceSystem', '출처'], ['window', '관찰 기간'], ['attribution', '귀속'], ['limitation', '해석 한계']].map(([field, label]) => <ReportField key={field} label={label} value={row[field]} />)}</dl><Source row={row} /></article>)}
        {notes(records(['attribution']))}{item.attributionLimit && <p className="ir-limit">{item.attributionLimit}</p>}
      </Detail>
    </ReportChapter>

    <ReportChapter {...chapter('learning', '05', '실험에서 다음 캠페인으로', '설계 → 관찰 → 결정, 수정 → 반응 → 다음 실행을 연결합니다.', ['experiments', 'optimization'])}>
      <ExperimentStoryboard rows={w.experiments} role="marketing" />
      <ImprovementTrail rows={w.optimization} />
      {!w.experiments.length && !w.optimization.length && <ReportEmpty>바꾼 변수, 관찰한 반응, 이후 유지·수정·중단한 선택을 연결하세요.</ReportEmpty>}
      {item.nextExperiment && <div className="mir-next"><small>NEXT EXPERIMENT</small><p>{item.nextExperiment}</p></div>}
      <Detail title="실험 · 개선 · 후속 판단의 원문 펼치기">{notes(records(['experiment', 'learning']))}</Detail>
    </ReportChapter>
  </div>;
}