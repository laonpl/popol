import { PM_WORK_PRODUCTS } from '../../utils/pmWorkProducts';
import { PM_STAGE_LABELS } from '../../utils/pmEvidence';
import './PmCaseArtifacts.css';

function Value({ row, field, fallback = '자료에 미기록' }) {
  return <span className={row[field] ? '' : 'pm-artifact-unknown'}>{row[field] || fallback}</span>;
}

function Fields({ row, fields }) {
  return <dl className="pm-artifact-fields">{fields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd><Value row={row} field={key} /></dd></div>)}</dl>;
}

export default function PmCaseArtifacts({ item, SourceExcerpt }) {
  const available = PM_WORK_PRODUCTS.filter(group => item.workProducts[group.key].length);
  const absent = PM_WORK_PRODUCTS.filter(group => !item.workProducts[group.key].length);
  if (!available.length) return <div className="pm-artifact-migration"><b>요약에서 실제 산출물로</b><p>현재 저장된 결과에는 구조화된 PM 산출물이 없습니다. PRD·정책서, 대안 검토, 사용자 흐름, 실험·협업 기록을 추가하고 ‘PM 산출물 다시 추출’을 실행하면 아래 요약과 별도로 작업 내용을 정리합니다.</p></div>;
  return <div className="pm-case-artifacts">
    <nav className="pm-artifact-nav print:hidden" aria-label="PM 산출물 바로가기">{available.map(group => <a href={`#${item.id}-${group.key}`} key={group.key}>{group.label}</a>)}</nav>
    {available.map((group, groupIndex) => <section className={`pm-artifact-section pm-artifact-${group.key}`} key={group.key} id={`${item.id}-${group.key}`} aria-label={group.label}>
      <header><span className="pm-artifact-number">{String(groupIndex + 1).padStart(2, '0')}</span><div><small>{group.eyebrow}</small><h4>{group.label}</h4><p>{group.description}</p></div></header>
      {group.key === 'alternatives' ? <div className="pm-options-list">{item.workProducts.alternatives.map((row, i) => <article key={i} className={`pm-option ${row.disposition === '채택' ? 'is-selected' : ''}`}>
        <header><span className="pm-option-state">{row.disposition || '미확인'}</span><h5>{row.option || '대안명 미기록'}</h5><small>{PM_STAGE_LABELS[row.stage]}</small></header>
        <Fields row={row} fields={group.fields.slice(2)} /><SourceExcerpt record={row} />
      </article>)}</div> : group.key === 'journey' ? <><p className="pm-artifact-note">원문에 기록된 순서입니다. 설계·변경안은 실제 출시 또는 성과를 의미하지 않습니다.</p><ol className="pm-service-flow">{item.workProducts.journey.map((row, i) => <li key={i}>
        <div className="pm-flow-marker">{i + 1}</div><article><header><div><small>{row.actor || '행동 주체 미기록'} · {PM_STAGE_LABELS[row.stage]}</small><h5>{row.step || `단계 ${i + 1}`}</h5></div></header>
          <div className="pm-flow-comparison"><div><small>BEFORE · 기존</small><p><Value row={row} field="before" /></p></div><span aria-hidden="true">→</span><div><small>AFTER · 설계·변경</small><p><Value row={row} field="after" /></p></div></div>
          {row.exception && <p className="pm-flow-exception"><b>예외 처리</b>{row.exception}</p>}<SourceExcerpt record={row} />
        </article></li>)}</ol></> : group.key === 'requirements' ? <div className="pm-spec-list">{item.workProducts.requirements.map((row, i) => <article key={i} className="pm-spec">
        <header><code>REQ-{String(i + 1).padStart(2, '0')}</code><h5>{row.requirement || '요구사항'}</h5><small>{PM_STAGE_LABELS[row.stage]}</small></header>
        <Fields row={row} fields={group.fields.slice(1)} /><SourceExcerpt record={row} />
      </article>)}</div> : <div className="pm-artifact-records">{item.workProducts[group.key].map((row, i) => <article key={i}>
        <div className="pm-artifact-stage">{PM_STAGE_LABELS[row.stage]}{row.basis === 'unlocated' ? ' · 원문 확인 필요' : row.basis === 'self_report' ? ' · 본인 진술' : ''}</div>
        <Fields row={row} fields={group.fields} /><SourceExcerpt record={row} />
      </article>)}</div>}
    </section>)}
    {absent.length > 0 && <details className="pm-artifact-missing print:hidden"><summary>아직 연결하지 못한 산출물 · {absent.length}개 영역</summary><p>모든 프로젝트에 모든 산출물이 필요한 것은 아닙니다. 실제로 수행한 작업만 추가하세요.</p>{absent.map(group => <div key={group.key}><b>{group.label}</b><span>{group.description}</span></div>)}</details>}
  </div>;
}
