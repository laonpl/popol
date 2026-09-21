import { useId, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, GitBranch, FileCheck2 } from 'lucide-react';
import { PM_COMPANY_REFERENCES, PM_PORTFOLIO_REFERENCES } from '../../utils/pmPortfolioViews';
import { PM_DIMENSIONS, PM_STAGE_LABELS } from '../../utils/pmEvidence';
import { Block, Outcome } from './PmWorkProductBlocks';
import './PmPortfolioBoard.css';
import './ProductDecisionPortfolio.css';

const CHAPTERS = [
  { key: 'context', label: '문제 발견', title: '누구의 어떤 문제를 발견했는가', groups: ['problems', 'research', 'businessModel'], dimensions: ['discovery'], missing: '인터뷰·VOC·행동 기록에서 발견한 문제와 지금 해결해야 하는 이유' },
  { key: 'decisions', label: '선택과 우선순위', title: '왜 이 해결책을 먼저 선택했는가', groups: ['alternatives', 'metricLinks'], dimensions: ['prioritization'], missing: '실제로 비교한 대안, 판단 기준, MVP에서 제외한 범위와 이유' },
  { key: 'spec', label: '제품 설계', title: '선택을 어떤 동작과 정책으로 만들었는가', groups: ['requirements'], dimensions: [], missing: '화면 흐름·정책서의 처리 조건, 예외 상태, 인수 기준' },
  { key: 'release', label: '내 기여와 실행', title: '내가 맡은 일과 팀을 움직인 과정', groups: ['releases', 'collaboration', 'risks'], dimensions: ['delivery'], missing: '내가 직접 결정·작성·조율한 일과 팀원의 실행 범위, 출시 상태' },
  { key: 'validation', label: '검증과 결과', title: '무엇으로 확인했고, 실제로 무엇이 달라졌는가', groups: ['experiments'], dimensions: ['validation', 'outcome'], missing: '검증 방법과 실제 관찰 결과. 수치는 기간·대상·측정 기준을 함께 기록' },
  { key: 'learning', label: '회고와 다음 결정', title: '예상과 달랐던 점을 다음 판단에 반영하다', groups: ['troubleshooting'], dimensions: ['learning'], missing: '잘되지 않은 이유, 수정하거나 중단한 선택, 다음에 확인할 가설' },
];
const value = (text, fallback = '기록 없음') => text || fallback;

function FlowExplorer({ item, Source }) {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const blueprint = item.workProducts.serviceBlueprint || [];
  const journey = item.workProducts.journey || [];
  const rows = blueprint.length ? blueprint : journey;
  const index = Math.min(selected, Math.max(rows.length - 1, 0));
  if (!rows.length) return null;
  const fields = blueprint.length
    ? [['customerAction', '고객 행동'], ['frontstage', '화면 · 접점'], ['backstage', '운영 · 파트너'], ['system', '시스템'], ['exception', '예외 · 실패']]
    : [['actor', '행동 주체'], ['before', '기존 흐름'], ['after', '설계 · 변경'], ['exception', '예외 처리']];
  return <section className="pd-flow" aria-label="제품 동작 탐색기">
    <header><div><span><GitBranch size={14} /> SERVICE LOGIC</span><h4>이 제품은 어떻게 작동하는가</h4></div><small>{blueprint.length ? '접점 · 운영 · 시스템' : '변경 전후 · 사용자 흐름'}</small></header>
    <p className="pd-flow-help">단계를 선택해 동작과 예외를 확인하세요. 표시 순서는 원문에 정리된 흐름이며 출시·구현 여부는 각 기록의 단계를 따릅니다.</p>
    <div className="pd-flow-workspace">
      <div className="pd-flow-nodes" role="tablist" aria-label="서비스 단계" aria-orientation="vertical">{rows.map((row, i) => <button type="button" key={i} role="tab" id={id + '-node-' + i} aria-controls={id + '-detail-' + i} aria-selected={index === i} tabIndex={index === i ? 0 : -1} onClick={() => setSelected(i)} onKeyDown={event => {
        const next = event.key === 'ArrowDown' ? (i + 1) % rows.length : event.key === 'ArrowUp' ? (i + rows.length - 1) % rows.length : event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : null;
        if (next !== null) { event.preventDefault(); setSelected(next); document.getElementById(id + '-node-' + next)?.focus(); }
      }}><code>{String(i + 1).padStart(2, '0')}</code><span>{value(row.step, '이름 없는 단계')}<small>{PM_STAGE_LABELS[row.stage] || '단계 확인 필요'}</small></span><ArrowRight size={14} /></button>)}</div>
      <div className="pd-flow-inspectors">{rows.map((row, i) => <article role="tabpanel" id={id + '-detail-' + i} aria-labelledby={id + '-node-' + i} key={i} className={index === i ? 'pd-inspector' : 'pd-inspector pd-inspector-hidden'}>
        <header><code>STEP {String(i + 1).padStart(2, '0')} / SPECIFICATION</code><h5>{row.step}</h5></header>
        <dl>{fields.map(([field, label]) => <div key={field} className={field === 'exception' ? 'pd-exception' : ''}><dt>{label}</dt><dd>{value(row[field], '이 단계의 ' + label + '은 원문에 없습니다.')}</dd></div>)}</dl>
        {row.userEdited && <small>직접 수정한 정리 · 원문 대조 필요</small>}<Source record={row} />
      </article>)}</div>
    </div>
    {!!blueprint.length && !!journey.length && <details className="pd-detail"><summary>사용자 여정의 변경 전후도 보기 <ChevronDown size={14} /></summary><Block group="journey" rows={journey} Source={Source} /></details>}
  </section>;
}

function DecisionDossier({ item, Source, renderRecord, renderArtifacts, readOnly }) {
  const id = useId();
  const w = item.workProducts;
  const hasFlow = !!(w.serviceBlueprint?.length || w.journey?.length);
  const chapters = CHAPTERS.map(chapter => ({ ...chapter,
    records: item.records.filter(record => chapter.dimensions.includes(record.dimension)),
  })).filter(chapter => chapter.records.length || chapter.groups.some(group => w[group]?.length) || (chapter.key === 'spec' && hasFlow) || (chapter.key === 'validation' && item.metrics.length));
  const missing = CHAPTERS.filter(chapter => !chapters.some(entry => entry.key === chapter.key));
  const problem = w.problems?.[0]?.problem || item.records.find(row => row.dimension === 'discovery')?.claim;
  const decision = w.alternatives?.find(row => row.disposition === '채택');
  const owners = [...new Set([...item.records.map(row => row.ownership), ...(w.requirements || []).map(row => row.owner)].filter(Boolean))];
  const result = item.metrics.find(metric => metric.basis !== 'unlocated' && metric.actual);
  return <div className="pd-dossier">
    <header className="pd-product-brief"><div><span>PRODUCT CASE STUDY</span><h3>{item.title}</h3>{problem && <p>{problem}</p>}</div><dl>{decision && <div><dt>선택한 방향 · {PM_STAGE_LABELS[decision.stage]}</dt><dd>{decision.option}</dd></div>}<div><dt>내 책임 범위</dt><dd>{owners.length ? owners.join(' / ') : '담당 범위를 확인할 원문이 필요합니다.'}</dd></div>{result && <div><dt>기록된 결과 · {result.name}</dt><dd>{result.baseline ? result.baseline + ' → ' : ''}{result.actual}<small>{[result.period, result.population].filter(Boolean).join(' · ') || '기간·대상 확인 필요'}</small></dd></div>}</dl></header>
    <nav className="pd-document-index print:hidden" aria-label="제품 설계 문서 목차">{chapters.map((chapter, i) => <a key={chapter.key} href={'#' + id + '-' + chapter.key}>{String(i + 1).padStart(2, '0')} {chapter.label}</a>)}<a href={'#' + id + '-sources'}>근거 자료</a></nav>
    {chapters.map((chapter, i) => <section key={chapter.key} id={id + '-' + chapter.key} className={'pd-chapter pd-chapter-' + chapter.key}>
      <header className="pd-chapter-heading"><span>{String(i + 1).padStart(2, '0')}</span><div><small>{chapter.label}</small><h3>{chapter.title}</h3></div><FileCheck2 size={19} /></header>
      {chapter.records.map(record => <article className="pm-proof-record pd-chapter-record" key={record.id}><div className="pd-record-label"><span>{PM_DIMENSIONS.find(dimension => dimension.key === record.dimension)?.label}</span><small>{PM_STAGE_LABELS[record.stage]}</small></div>{renderRecord(item, record)}</article>)}
      {chapter.key === 'spec' && hasFlow && <FlowExplorer item={item} Source={Source} />}
      {chapter.groups.map(group => <Block key={group} group={group} rows={w[group] || []} Source={Source} />)}
      {chapter.key === 'validation' && <Outcome item={item} Source={Source} />}
    </section>)}
    <section id={id + '-sources'} className="pd-source-appendix">{renderArtifacts?.(item)}</section>
    {!readOnly && missing.length > 0 && <aside className="pd-missing-design pd-completion-guide print:hidden"><div><h4>포트폴리오에서 더 설명할 부분</h4><p>현재 기록에 없는 단계입니다. 실제 자료가 있는 항목만 보완하세요. 출시 전 프로젝트에 매출이나 출시 성과를 요구하지 않습니다.</p><ul>{missing.map(chapter => <li key={chapter.key}><b>{chapter.label}</b><span>{chapter.missing}</span></li>)}</ul><p>경험정리 페이지의 보관함에 자료를 추가하고 저장한 뒤 ‘산출물 다시 추출’을 실행하면 본문에 반영됩니다.</p></div></aside>}
  </div>;
}

export default function PmPortfolioBoard({ model, Source, renderRecord, readOnly, renderArtifacts }) {
  const [active, setActive] = useState(0);
  const id = useId(), cases = model.cases;
  const selected = Math.min(active, Math.max(0, cases.length - 1));
  return <section className="pm-proof pm-portfolio-board pd-portfolio" aria-label="PM 핵심 경험 포트폴리오">
    <header className="pd-masthead"><span>PRODUCT / CASE STUDY</span><b>문제를 제품으로 바꾼 과정</b><small>문제 발견 → 선택과 우선순위 → 제품 설계 → 내 기여와 실행 → 검증과 결과 → 다음 결정</small></header>
    {cases.length ? <><div className="pm-proof-tabs pd-case-files print:hidden" role="tablist" aria-label="제품 의사결정 선택">{cases.map((item, i) => <button type="button" role="tab" key={item.id} id={id + '-tab-' + i} aria-selected={selected === i} tabIndex={selected === i ? 0 : -1} aria-controls={id + '-panel-' + i} onClick={() => setActive(i)} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (i + 1) % cases.length : event.key === 'ArrowLeft' ? (i + cases.length - 1) % cases.length : event.key === 'Home' ? 0 : event.key === 'End' ? cases.length - 1 : null;
      if (next !== null) { event.preventDefault(); setActive(next); document.getElementById(id + '-tab-' + next)?.focus(); }
    }}><code>{String(i + 1).padStart(2, '0')}</code><span>{item.title}</span></button>)}</div>{cases.map((item, i) => <article key={item.id} role="tabpanel" id={id + '-panel-' + i} aria-labelledby={id + '-tab-' + i} className={'pm-proof-case ' + (selected === i ? '' : 'pm-proof-inactive')}><DecisionDossier item={item} Source={Source} renderRecord={renderRecord} renderArtifacts={renderArtifacts} readOnly={readOnly} /></article>)}</> : <div className="pm-proof-empty"><h3>어떤 제품의 어떤 결정을 책임졌나요?</h3><p>기획서·사용자 조사·정책·실험 기록에서 시작하세요.</p></div>}
    {!readOnly && <details className="pm-reference-disclosure print:hidden"><summary>구성에 참고한 기업·공개 실무 자료 <ChevronDown size={14} /></summary><p>기업별 공통 합격 공식이 아닙니다. 공개 포트폴리오와 직무 전환 사례는 합격 제출본 확인 여부와 구분해 참고했습니다.</p><div>{[...PM_COMPANY_REFERENCES, ...PM_PORTFOLIO_REFERENCES].map(([company, role, focus, url]) => <a key={company} href={url} target="_blank" rel="noreferrer"><b>{company}</b><span>{role}</span><p>{focus}</p><ArrowUpRight size={13} /></a>)}</div></details>}
  </section>;
}
