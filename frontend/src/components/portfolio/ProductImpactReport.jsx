import { ArrowRight, Network } from 'lucide-react';
import { splitProductDecisions, roleReportCounts } from '../../utils/roleImpactReport';
import { ReportChapter, ReportField, ReportEmpty, ReportStats, ReportJump } from './ImpactReportParts';
import { ProductDecisionCanvas, MvpScopeCanvas, ServiceDesignCanvas, PolicyCanvas, ReleaseTimeline, MetricGraphic, ExperimentStoryboard, ImprovementTrail } from './RoleVisualCanvas';
import RoleArtifactStudio from './RoleArtifactStudio';
import { caseArtifacts } from '../../utils/roleArtifacts';
import './RoleImpactReport.css';

function Detail({ title, children }) {
  return <details className="ir-visual-detail" data-print="true"><summary>{title}</summary><div>{children}</div></details>;
}

export default function ProductImpactReport({ item, sr, Source, renderRecord, onChange, prefix }) {
  const w = item.workProducts, scope = splitProductDecisions(w.alternatives);
  const prototypeFiles = caseArtifacts(sr || {}, item);
  const narrative = dimensions => item.records.filter(row => dimensions.includes(row.dimension));
  const notes = dimensions => narrative(dimensions).map(row => <article className="pir-narrative" key={row.id}>{renderRecord(item, row)}</article>);
  const chapter = (key, number, title, subtitle, groups) => ({ id: `${prefix}-${key}`, number, title, subtitle, groups, sr, item, role: 'pm', onChange });
  return <div className="pir-report visual-report" aria-label="제품 판단과 설계 리포트">
    <header className="pir-hero"><div><span>PRODUCT DESIGN / DECISION CANVAS</span><h2>{item.title}</h2></div><div className="pir-visual-kicker"><Network size={27} /><div><b>{scope.selected[0]?.option || '제품 의사결정'}</b><small>{scope.selected.length ? 'MVP에 선택한 방향' : '고객 발견 · 설계 · 검증'}</small></div></div></header>
    <ReportStats rows={roleReportCounts(item, 'pm')} />
    <ReportJump entries={[['context', '문제 · 판단 지도'], ['decisions', 'MVP 범위'], ['spec', '서비스 설계'], ['release', '출시 · 조율'], ['validation', '검증 · 임팩트'], ['learning', '회고']].map(([key, label]) => [`${prefix}-${key}`, label])} />

    <ReportChapter {...chapter('context', '01', '고객의 신호에서 제품의 결정까지', '관찰 → 문제 정의 → 선택과 포기. 노드를 선택해 판단 근거를 확인하세요.', ['problems', 'research', 'businessModel'])}>
      <ProductDecisionCanvas item={item} Source={Source} />
      <Detail title="고객 관찰 · 문제 정의 · 사업 맥락 펼치기">
        {w.problems.map((row, i) => <article className="pir-problem" key={i}><h4>{row.problem}</h4><dl>{[['user', '대상'], ['context', '맥락'], ['signal', '신호'], ['businessReason', '사업적 이유']].map(([field, label]) => <ReportField key={field} label={label} value={row[field]} />)}</dl><Source record={row} /></article>)}
        {w.research.map((row, i) => <article className="pir-narrative" key={i}><h4>{row.segment}</h4><dl>{[['observation', '관찰'], ['insight', '해석'], ['opportunity', '제품 기회'], ['limitation', '한계']].map(([field, label]) => <ReportField key={field} label={label} value={row[field]} />)}</dl><Source record={row} /></article>)}
        {w.businessModel.map((row, i) => <article className="pir-narrative" key={i}><h4>{row.value}</h4><dl>{[['customer', '사용자'], ['payer', '비용 부담'], ['revenue', '사업 기여'], ['cost', '운영 비용'], ['tradeoff', '가치 충돌']].map(([field, label]) => <ReportField key={field} label={label} value={row[field]} />)}</dl><Source record={row} /></article>)}
        {notes(['discovery'])}
      </Detail>
    </ReportChapter>

    <ReportChapter {...chapter('decisions', '02', 'MVP의 경계와 우선순위', '제품에 포함한 선택과 이번 범위에서 제외한 선택을 구분합니다.', ['alternatives', 'metricLinks'])}>
      <MvpScopeCanvas rows={w.alternatives} Source={Source} />
      {w.metricLinks.length > 0 && <div className="pir-driver-map">{w.metricLinks.map((row, i) => <article key={i}><div><small>바꾸려는 사용자 행동</small><b>{row.driver}</b></div><ArrowRight size={24} /><div><small>연결해서 확인할 지표</small><b>{row.outcome}</b></div><p>{row.relationship}</p><Source record={row} /></article>)}</div>}
      <Detail title="우선순위 기준 · 대안 비교 기록 펼치기">{w.alternatives.map((row, i) => <article className="pir-narrative" key={i}><h4>{row.option} · {row.disposition || '판단 미기록'}</h4><dl>{[['criterion', '기준'], ['reason', '선택 · 제외 이유'], ['tradeoff', '감수한 제약']].map(([field, label]) => <ReportField key={field} label={label} value={row[field]} />)}</dl><Source record={row} /></article>)}{w.metricLinks.map((row, i) => <article key={i}><dl><ReportField label="측정" value={row.measurement} /><ReportField label="보호 지표" value={row.guardrail} /></dl></article>)}{notes(['prioritization'])}</Detail>
    </ReportChapter>

    <ReportChapter {...chapter('spec', '03', '내가 설계한 서비스 동작도', '사용자 흐름을 따라 화면·운영·시스템·예외를 탐색합니다.', ['journey', 'serviceBlueprint', 'requirements'])}>
      <ServiceDesignCanvas workProducts={w} Source={Source} />
      <PolicyCanvas rows={w.requirements} Source={Source} />
      {prototypeFiles.some(file => file.image) && <div className="vc-prototype-shelf"><RoleArtifactStudio sr={sr} item={item} role="pm" showcase compact onChange={onChange} readOnly={!onChange} /></div>}
      {w.serviceBlueprint.length > 0 && w.journey.length > 0 && <Detail title="사용자 여정의 변경 전후도 확인하기">{w.journey.map((row, i) => <article className="pir-narrative" key={i}><h4>{row.step}</h4><dl><ReportField label="사용자" value={row.actor} /><ReportField label="변경 전" value={row.before} /><ReportField label="변경 후" value={row.after} /><ReportField label="예외" value={row.exception} /></dl><Source record={row} /></article>)}</Detail>}
    </ReportChapter>

    <ReportChapter {...chapter('release', '04', '출시를 움직인 실행과 조율', '기록된 이정표의 흐름과 내가 해결한 의존성을 보여줍니다.', ['releases', 'collaboration', 'risks'])}>
      <ReleaseTimeline rows={w.releases} Source={Source} />
      <div className="pir-alignment">{w.collaboration.map((row, i) => <article key={i}><small>{row.stakeholder}와의 조율</small><div><p><span>이견 · 의존성</span>{row.disagreement}</p><ArrowRight size={21} /><p><span>내가 한 행동</span>{row.myAction}</p><ArrowRight size={21} /><p><span>도달한 합의</span>{row.agreement}</p></div><Source record={row} /></article>)}</div>
      {!w.releases.length && !w.collaboration.length && <ReportEmpty>출시 이정표 또는 내가 조율한 이견을 추가하면 실행 흐름이 나타납니다.</ReportEmpty>}
      <Detail title="실행 기여 · 리스크와 대응 기록 펼치기">{notes(['delivery'])}{w.risks.map((row, i) => <article className="pir-narrative" key={i}><h4>{row.risk}</h4><dl>{[['trigger', '발생 조건'], ['mitigation', '대응'], ['owner', '책임'], ['result', '관찰 결과']].map(([field, label]) => <ReportField key={field} label={label} value={row[field]} />)}</dl><Source record={row} /></article>)}</Detail>
    </ReportChapter>

    <ReportChapter {...chapter('validation', '05', '가설 검증과 제품 임팩트', '실측 지표와 검증 설계 → 관찰 → 후속 결정을 나란히 읽습니다.', ['experiments'])}>
      <div className="pir-metrics">{item.metrics.map((row, i) => <article key={i}><header><h4>{row.name}</h4></header><MetricGraphic metric={row} /><p className="ir-measurement">{[row.period, row.population, row.method].filter(Boolean).join(' · ') || '측정 조건 미기록'}</p><Source record={row} />{row.limitation && <p className="ir-limit">{row.limitation}</p>}</article>)}</div>
      <ExperimentStoryboard rows={w.experiments} Source={Source} />
      {!item.metrics.length && !w.experiments.length && <ReportEmpty>검증한 가설과 실제 관찰값을 연결하세요. 정성적인 테스트도 기록할 수 있습니다.</ReportEmpty>}
      <Detail title="검증 · 관찰 · 결과 해석 펼치기">{notes(['validation', 'outcome'])}</Detail>
    </ReportChapter>

    <ReportChapter {...chapter('learning', '06', '다음 제품 결정을 바꾼 회고', '원인 → 수정 → 반응 → 다음 판단의 흐름으로 정리합니다.', ['troubleshooting'])}>
      <ImprovementTrail rows={w.troubleshooting} Source={Source} />
      {!w.troubleshooting.length && <ReportEmpty>예상과 달랐던 점과 유지·변경·중단한 선택을 기록하세요.</ReportEmpty>}
      <Detail title="기존 회고와 다음 판단 펼치기">{notes(['learning'])}</Detail>
    </ReportChapter>
  </div>;
}
