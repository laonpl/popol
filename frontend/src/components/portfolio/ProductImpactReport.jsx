import { ArrowRight, GitBranch, Layers, Check, X, Flag } from 'lucide-react';
import { PM_STAGE_LABELS } from '../../utils/pmEvidence';
import { splitProductDecisions, productServiceLayers, roleReportCounts } from '../../utils/roleImpactReport';
import { ReportChapter, ReportEmpty, ReportField, ComparisonBars, ReportStats, ReportJump } from './ImpactReportParts';
import './RoleImpactReport.css';

export default function ProductImpactReport({ item, sr, Source, renderRecord, onChange, prefix }) {
  const w = item.workProducts;
  const decisions = splitProductDecisions(w.alternatives), service = productServiceLayers(w);
  const problem = w.problems[0], research = w.research[0];
  const narrative = dimensions => item.records.filter(row => dimensions.includes(row.dimension));
  const notes = dimensions => narrative(dimensions).map(row => <article className="pir-narrative" key={row.id}>{renderRecord(item, row)}</article>);
  const chapter = (key, number, title, subtitle, groups) => ({ id: `${prefix}-${key}`, number, title, subtitle, groups, sr, item, role: 'pm', onChange });
  const stages = [['selected', 'MVP에 선택한 것', Check], ['excluded', '보류 · 제외한 것', X], ['undecided', '판단을 남겨 둔 것', Flag]];
  const completed = [...w.releases].filter(row => ['executed', 'observed', 'changed'].includes(row.stage));
  return <div className="pir-report" aria-label="제품 판단과 설계 리포트">
    <header className="pir-hero"><div><span>PRODUCT IMPACT REPORT</span><h2>문제를 발견하고,<br />제품의 방향을 결정하다.</h2><p>{item.title}</p></div><div className="pir-hero-signal"><GitBranch size={30} /><small>내가 바꾼 제품의 선택</small><b>{decisions.selected[0]?.option || problem?.problem || narrative(['prioritization', 'discovery'])[0]?.claim || '고객 문제와 제품 판단을 연결하세요'}</b><span>{completed.length ? `실행 기록 ${completed.length}건` : w.releases.length ? '출시 계획과 진행 상태 기록' : '리서치 · 설계 · 검증 기록'}</span></div></header>
    <ReportStats rows={roleReportCounts(item, 'pm')} />
    <ReportJump entries={[['context', '문제와 고객'], ['decisions', '우선순위 · MVP'], ['spec', '제품 설계도'], ['release', '출시 · 협업'], ['validation', '검증 · 지표'], ['learning', '다음 판단']].map(([key, label]) => [`${prefix}-${key}`, label])} />

    <ReportChapter {...chapter('context', '01', '사용자의 신호를 제품의 문제로', '관찰한 사실, 나의 해석, 해결할 기회를 연결합니다.', ['problems', 'research', 'businessModel'])}>
      <div className="pir-discovery"><div className="pir-problem"><small>PROBLEM STATEMENT</small><h4>{problem?.problem || narrative(['discovery'])[0]?.claim || '정의한 고객 문제를 기록하세요'}</h4><dl><ReportField label="대상 사용자" value={problem?.user || research?.segment} /><ReportField label="문제를 만난 맥락" value={problem?.context} /><ReportField label="지금 해결할 이유" value={problem?.businessReason || w.businessModel[0]?.value} /></dl>{problem && <Source record={problem} />}</div>
        <div className="pir-research">{w.research.map((row, index) => <article key={index}><header><span>INSIGHT {String(index + 1).padStart(2, '0')}</span><b>{row.segment}</b></header><ol>{[['observation', '들은 말 · 본 행동'], ['insight', '내가 해석한 문제'], ['opportunity', '제품에 반영할 기회']].filter(([field]) => row[field]).map(([field, label]) => <li key={field}><small>{label}</small><p>{row[field]}</p></li>)}</ol>{row.limitation && <p className="ir-limit">{row.limitation}</p>}<Source record={row} /></article>)}{!w.research.length && <ReportEmpty>인터뷰의 한 문장, VOC, 이탈한 사용자 행동을 연결하면 고객 인사이트가 여기에 나타납니다.</ReportEmpty>}</div>
      </div>{notes(['discovery'])}
      {w.businessModel.length > 0 && <div className="pir-business">{w.businessModel.map((row, i) => <article key={i}><div><small>사용자 가치</small><b>{row.value || row.customer}</b></div><ArrowRight size={18} /><div><small>사업에 돌아오는 가치</small><b>{row.revenue || '사업 기여 미기록'}</b><p>{[row.payer, row.cost, row.tradeoff].filter(Boolean).join(' · ')}</p></div><Source record={row} /></article>)}</div>}
    </ReportChapter>

    <ReportChapter {...chapter('decisions', '02', '우선순위와 MVP의 경계를 정하다', '선택한 기능과 포기한 기능을 판단 근거와 함께 읽습니다.', ['alternatives', 'metricLinks'])}>
      <div className="pir-scope-board">{stages.map(([key, label, Icon]) => <section key={key} data-disposition={key}><header><Icon size={15} /><h4>{label}</h4><span>{decisions[key].length}</span></header>{decisions[key].map((row, i) => <article key={i}><h5>{row.option}</h5><dl><ReportField label="판단 기준" value={row.criterion} /><ReportField label="선택 · 제외한 이유" value={row.reason} /><ReportField label="얻는 것과 감수한 제약" value={row.tradeoff} /></dl><Source record={row} /></article>)}{!decisions[key].length && <p className="pir-board-empty">이 결정의 기록이 없습니다.</p>}</section>)}</div>
      {notes(['prioritization'])}
      {w.metricLinks.length > 0 && <div className="pir-driver-map">{w.metricLinks.map((row, i) => <article key={i}><div><small>바꾸려는 행동</small><b>{row.driver}</b></div><ArrowRight size={23} /><div><small>확인할 제품 지표</small><b>{row.outcome}</b></div><p>{row.relationship}</p><dl><ReportField label="측정" value={row.measurement} /><ReportField label="보호 지표" value={row.guardrail} /></dl><Source record={row} /></article>)}</div>}
    </ReportChapter>

    <ReportChapter {...chapter('spec', '03', '내가 설계한 제품의 작동 방식', '사용자 여정 위에 화면·운영·시스템·예외 처리를 펼칩니다.', ['journey', 'serviceBlueprint', 'requirements'])}>
      {service.steps.length ? <div className="pir-service-design"><div className="pir-design-label"><Layers size={16} /><b>{service.kind === 'blueprint' ? '서비스 블루프린트' : '사용자 흐름의 변경 전후'}</b><span>{service.steps.length}개 단계</span></div><div className="pir-blueprint-scroll" role="region" aria-label="제품 서비스 설계도" tabIndex={0}><table><thead><tr><th scope="col">설계 레이어</th>{service.steps.map((row, i) => <th scope="col" key={i}><small>{String(i + 1).padStart(2, '0')}</small>{row.step || `단계 ${i + 1}`}<span>{PM_STAGE_LABELS[row.stage] || '단계 미기록'}</span></th>)}</tr></thead><tbody>{service.layers.map(([field, label]) => <tr key={field} data-layer={field}><th scope="row">{label}</th>{service.steps.map((row, i) => <td key={i}>{row[field] || '—'}</td>)}</tr>)}<tr><th scope="row">연결 기록</th>{service.steps.map((row, i) => <td key={i}><Source record={row} /></td>)}</tr></tbody></table></div></div> : <ReportEmpty>유저 플로우나 정책서의 실제 단계를 추가하면 서비스 설계도가 만들어집니다.</ReportEmpty>}
      <div className="pir-policy-library">{w.requirements.map((row, i) => <article key={i}><header><code>SPEC {String(i + 1).padStart(2, '0')}</code><span>{PM_STAGE_LABELS[row.stage]}</span></header><h4>{row.requirement}</h4><div><small>조건 · 분기 · 처리</small><p>{row.rule || '처리 규칙 미기록'}</p></div><div className="pir-acceptance"><Check size={14} /><p><small>완료를 확인하는 기준</small>{row.acceptance || '인수 기준 미기록'}</p></div>{row.owner && <p className="pir-ownership">내 책임 · {row.owner}</p>}<Source record={row} /></article>)}</div>
    </ReportChapter>

    <ReportChapter {...chapter('release', '04', '팀과 제품을 움직인 나의 역할', '출시 범위, 의존성, 합의와 실행 상태를 구분합니다.', ['releases', 'collaboration', 'risks'])}>
      <ol className="pir-release-roadmap">{w.releases.map((row, i) => <li key={i} data-stage={row.stage}><span>{String(i + 1).padStart(2, '0')}</span><article><header><h4>{row.milestone}</h4><b>{row.status || PM_STAGE_LABELS[row.stage]}</b></header><p>{row.scope}</p><dl><ReportField label="먼저 해결할 의존성" value={row.dependency} /><ReportField label="출시 · 인수 조건" value={row.gate} /></dl><Source record={row} /></article></li>)}</ol>
      {notes(['delivery'])}
      <div className="pir-alignment">{w.collaboration.map((row, i) => <article key={i}><small>함께 결정한 사람 · {row.stakeholder}</small><div><p><span>이견</span>{row.disagreement}</p><ArrowRight size={18} /><p><span>내 조율</span>{row.myAction}</p><ArrowRight size={18} /><p><span>합의</span>{row.agreement}</p></div><Source record={row} /></article>)}</div>
      {w.risks.length > 0 && <div className="pir-risks">{w.risks.map((row, i) => <article key={i}><Flag size={14} /><div><b>{row.risk}</b><p>{[row.trigger, row.mitigation, row.result].filter(Boolean).join(' → ')}</p>{row.owner && <small>책임 범위 · {row.owner}</small>}<Source record={row} /></div></article>)}</div>}
      {!w.releases.length && !w.collaboration.length && !narrative(['delivery']).length && <ReportEmpty>출시 전이어도 내가 합의한 범위와 팀의 실행을 구분해 기록할 수 있습니다.</ReportEmpty>}
    </ReportChapter>

    <ReportChapter {...chapter('validation', '05', '가설을 실제 관찰로 확인하다', '목표, 관찰값, 검증 후 결정을 나란히 확인합니다.', ['experiments'])}>
      <div className="pir-metrics">{item.metrics.map((row, i) => <article key={i}><header><h4>{row.name}</h4><b>{row.actual || '아직 실측 없음'}</b></header><ComparisonBars metric={row} /><Source record={row} />{row.limitation && <p className="ir-limit">{row.limitation}</p>}</article>)}</div>
      <div className="pir-experiments">{w.experiments.map((row, i) => <article key={i}><header><code>TEST {String(i + 1).padStart(2, '0')}</code><b>{PM_STAGE_LABELS[row.stage]}</b></header><h4>{row.hypothesis}</h4><dl><ReportField label="검증 방법 · 대상" value={row.method} /><ReportField label="사전 성공 기준" value={row.successCriteria} /></dl><div className="pir-test-result"><p><small>실제로 관찰한 것</small>{row.observation || '결과 미기록'}</p><ArrowRight size={18} /><p><small>그 결과 내린 결정</small>{row.decision || '다음 판단 미기록'}</p></div><Source record={row} /></article>)}</div>
      {notes(['validation', 'outcome'])}{!item.metrics.length && !w.experiments.length && !narrative(['validation', 'outcome']).length && <ReportEmpty>사전 가설과 실제 테스트 결과를 추가하세요. 정성적인 관찰도 검증 기록으로 남길 수 있습니다.</ReportEmpty>}
    </ReportChapter>

    <ReportChapter {...chapter('learning', '06', '실패와 회고를 다음 제품 결정으로', '문제를 발견한 뒤 어떤 선택을 수정했는지 보여줍니다.', ['troubleshooting'])}>
      <div className="pir-iterations">{w.troubleshooting.map((row, i) => <article key={i}><header><code>ITERATION {String(i + 1).padStart(2, '0')}</code><h4>{row.issue}</h4></header><dl>{[['cause', '확인한 원인'], ['change', '바꾼 선택'], ['result', '관찰 결과'], ['learning', '다음 판단에 남긴 것']].map(([field, label]) => <ReportField key={field} label={label} value={row[field]} />)}</dl><Source record={row} /></article>)}</div>{notes(['learning'])}{!w.troubleshooting.length && !narrative(['learning']).length && <ReportEmpty>예상과 달랐던 점과 이후 유지·변경·중단한 선택을 남겨주세요.</ReportEmpty>}
    </ReportChapter>
  </div>;
}
