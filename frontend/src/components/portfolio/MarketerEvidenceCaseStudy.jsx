import { useId, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, PenLine } from 'lucide-react';
import { buildMarketerEvidenceModel, MARKETER_DIMENSIONS, MARKETER_STAGE_LABELS, METRIC_KINDS } from '../../utils/marketerEvidence';
import { MARKETER_WORK_PRODUCTS } from '../../utils/marketerWorkProducts';
import { caseArtifacts, roleSourceText } from '../../utils/roleArtifacts';
import { Field, Source, WorkBlock } from './MarketerWorkProductBlocks';
import RoleArtifactStudio from './RoleArtifactStudio';
import WorkProductReview from './WorkProductReview';
import { MARKETING_CHAPTERS, marketingCaseSections } from '../../utils/marketerCaseStudy';
import './MarketerPortfolioBoard.css';
import './CampaignShowcase.css';

function Narrative({ row, onSave }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(row.claim);
  return <article className="ma-narrative">
    <header><small>{MARKETER_DIMENSIONS.find(d => d.key === row.dimension)?.label}</small><span>{MARKETER_STAGE_LABELS[row.stage] || '단계 확인 필요'}</span>{onSave && <button type="button" className="print:hidden" aria-label="마케팅 판단 수정" onClick={() => { setDraft(row.claim); setEditing(true); }}><PenLine size={13} /></button>}</header>
    {editing ? <form className="ma-narrative-editor print:hidden" onSubmit={event => { event.preventDefault(); onSave(draft.trim()); setEditing(false); }}><label>내 판단과 실행<textarea autoFocus rows={4} maxLength={1600} value={draft} onChange={event => setDraft(event.target.value)} /></label><p>연결된 원문은 유지됩니다. 표현과 실제 작업 범위가 일치하는지 확인하세요.</p><div><button type="button" onClick={() => setEditing(false)}>취소</button><button disabled={!draft.trim()} type="submit">적용</button></div></form> : <p>{row.claim}</p>}
    {row.limitation && <p className="ma-caution">해석 범위 · {row.limitation}</p>}<Source row={row} />
  </article>;
}

function Notes({ rows, item, sr, onChange, readOnly }) {
  if (!rows.length) return null;
  const save = (row, claim) => onChange({ ...sr, keyExperiences: sr.keyExperiences.map((experience, i) => i !== item.sourceIndex ? experience : { ...experience, jobData: { ...experience.jobData,
    marketerEvidence: experience.jobData.marketerEvidence.map((record, ri) => ri !== row.sourceRecordIndex ? record : { ...record, claim, userEdited: true }),
  } }) });
  return <div className="ma-notes">{rows.map(row => <Narrative key={row.id} row={row} onSave={!readOnly && onChange && !row.derivedLegacy ? claim => save(row, claim) : undefined} />)}</div>;
}

function Results({ item }) {
  if (!item.metrics.length) return null;
  return <section className="ma-results" aria-label="캠페인 결과 요약"><header><h3>캠페인 결과</h3><span>실측 · 목표 · 제작량 구분</span></header>
    {!!item.metrics.length && <div className="ma-result-grid">{item.metrics.map((row, i) => <article key={i}><div><small>{METRIC_KINDS[row.kind]}{row.channel && ' · ' + row.channel}</small><h4>{row.name}</h4></div><strong>{row.actual || '미확인'}</strong><p>기준 {row.baseline || '미기록'} <span>→</span> 목표 {row.target || '미기록'}</p>
      <div className="ma-measure-detail">{row.reportedValue && <p>기존 수치 · 원문 대조 전: {row.reportedValue}</p>}<dl>{[['period', '기간'], ['population', '대상 · 표본'], ['method', '측정 방법']].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{row[key] || '미기록'}</dd></div>)}</dl>{row.limitation && <p className="ma-caution">{row.limitation}</p>}<Source row={row} /></div>
    </article>)}</div>}
  </section>;
}

function Audience({ rows }) {
  if (!rows.length) return null;
  return <section className="ma-audience mk-work-block" aria-label="고객 선택의 근거"><header><h4>타깃을 선택한 근거</h4><span>{rows.length}개 기록</span></header>{rows.map((row, i) => <article key={i}><h5>{row.segment || '고객군 미기록'}</h5><div className="ma-insight-pair"><Field label="관찰한 신호" value={row.signal} /><Field label="고객이 원하는 것" value={row.need} /></div><div className="ma-insight-decision"><Field label="행동을 막는 장벽" value={row.barrier} /><Field label="그래서 선택한 접근" value={row.choice} /></div><Source row={row} /></article>)}</section>;
}

function CopyLibrary({ rows }) {
  if (!rows.length) return null;
  return <section className="ma-copy-library mk-work-block" aria-label="소재별 메시지와 표현 의도"><header><h4>소재별 메시지 설계</h4><span>추출 문안 · 원본 디자인 아님</span></header><div className="ma-copy-grid">{rows.map((row, i) => <article key={i}><header><b>{row.variant || '소재 ' + (i + 1)}</b><span>{MARKETER_STAGE_LABELS[row.stage] || '단계 확인 필요'}</span></header>{row.format && <small>{row.format}</small>}<div className="ma-copy-content"><span>후킹 문구</span><h5>{row.hook || '미기록'}</h5>{row.message && <p>{row.message}</p>}{row.cta && <div><small>CTA</small>{row.cta}</div>}</div><Field label="이 표현을 선택한 이유" value={row.rationale} />{row.observation && <Field label="소재에 대한 관찰" value={row.observation} />}<Source row={row} /></article>)}</div></section>;
}

function Campaign({ item, sr, onChange, readOnly }) {
  const id = useId(), w = item.workProducts;
  const records = dimensions => item.records.filter(row => dimensions.includes(row.dimension));
  const objective = records(['conversion']);
  const files = caseArtifacts(sr, item);
  const owner = [...new Set(item.evidenceRows.map(row => row.ownership).filter(Boolean))];
  const channels = [...new Set(w.channels.map(row => row.channel).filter(Boolean))];
  const periods = [...new Set(w.channels.map(row => row.period).filter(Boolean))];
  const sections = marketingCaseSections(item, { hasFiles: files.length > 0, editable: !readOnly && !!onChange });
  const missing = MARKETING_CHAPTERS.filter(chapter => !marketingCaseSections(item, { hasFiles: files.length > 0 }).some(section => section.key === chapter.key));
  const primaryMetric = item.metrics.find(row => row.actual && row.kind === 'outcome') || item.metrics.find(row => row.actual);
  const feedback = records(['attribution'])[0];
  const notes = rows => <Notes rows={rows} item={item} sr={sr} onChange={onChange} readOnly={readOnly} />;
  return <>
    <header className="ma-case-header"><span>MARKETING CASE STUDY</span><h2>{item.title}</h2>{objective.length > 0 ? <div className="ma-objective"><span>캠페인 과제</span>{notes(objective)}</div> : <p className="ma-unrecorded">캠페인의 과제와 목표를 설명할 기록이 필요합니다.</p>}
      <dl className="ma-scope">{channels.length > 0 && <div><dt>운영 접점</dt><dd>{channels.join(' · ')}</dd></div>}{periods.length > 0 && <div><dt>기록된 집행 기간</dt><dd>{periods.join(' / ')}</dd></div>}<div><dt>내가 직접 맡은 범위</dt><dd>{owner.length ? owner.join(' / ') : '담당 범위가 아직 기록되지 않았습니다.'}</dd></div></dl>
      {(primaryMetric || feedback) && <a className="ma-impact-preview" href={'#' + id + '-measurement'}><div><small>{primaryMetric ? METRIC_KINDS[primaryMetric.kind] : '기록된 고객 반응'}</small><b>{primaryMetric ? primaryMetric.name : feedback.claim}</b></div>{primaryMetric && <strong>{primaryMetric.actual}</strong>}<span>{primaryMetric ? [primaryMetric.period, primaryMetric.population].filter(Boolean).join(' · ') : ''}<small>측정 조건과 해석 보기 <ArrowUpRight size={12} /></small></span></a>}
    </header>
    <div className="ma-case-layout"><aside className="ma-outline print:hidden"><div><span>이 경험 읽기</span><nav aria-label="마케팅 사례 목차">{sections.map((section, i) => <a key={section.key} href={'#' + id + '-' + section.key}><small>{String(i + 1).padStart(2, '0')}</small>{section.label}</a>)}{!readOnly && <a href={'#' + id + '-review'}><small>↗</small>추출 내용 검토</a>}</nav><p>수치와 문장에 연결된 원문을 함께 확인할 수 있습니다.</p></div></aside>
      <div className="ma-case-body">{sections.map((section, i) => <section className={'ma-chapter ma-' + section.key} id={id + '-' + section.key} key={section.key}><header className="ma-chapter-heading"><span>{String(i + 1).padStart(2, '0')}</span><div><small>{section.label}</small><h3>{section.title}</h3></div></header>
        {section.key === 'strategy' && <>{notes(section.records)}<Audience rows={w.audiences} /><WorkBlock group="positioning" rows={w.positioning} /></>}
        {section.key === 'creative' && <>{(files.length > 0 || (!readOnly && onChange)) && <div className="ma-originals"><RoleArtifactStudio sr={sr} item={item} role="marketer" onChange={onChange} readOnly={readOnly} /></div>}{notes(section.records)}<CopyLibrary rows={w.creatives} /></>}
        {section.key === 'activation' && <><WorkBlock group="channels" rows={w.channels} /><WorkBlock group="contentSystem" rows={w.contentSystem} /><WorkBlock group="crm" rows={w.crm} /><WorkBlock group="operations" rows={w.operations} /></>}
        {section.key === 'measurement' && <><Results item={item} />{notes(section.records)}<WorkBlock group="measurement" rows={w.measurement} />{item.attributionLimit && <p className="ma-caution">성과 해석 범위 · {item.attributionLimit}</p>}</>}
        {section.key === 'learning' && <>{notes(section.records)}<WorkBlock group="experiments" rows={w.experiments} /><WorkBlock group="optimization" rows={w.optimization} />{item.nextExperiment && !section.records.some(row => row.claim === item.nextExperiment) && <div className="ma-next"><span>다음에 검증할 것</span><p>{item.nextExperiment}</p></div>}</>}
      </section>)}
      {!readOnly && <section className="ma-review print:hidden" id={id + '-review'}><h3>추출 내용 검토</h3><p>정리한 표현과 실제 작업 범위가 일치하는지 확인하세요. 수정해도 연결된 원문은 바뀌지 않습니다.</p><WorkProductReview sr={sr} item={item} groups={MARKETER_WORK_PRODUCTS} role="marketer" onChange={onChange} /></section>}
      {!readOnly && missing.length > 0 && <aside className="ma-completion print:hidden"><h4>이 경험에 더해 볼 내용</h4><p>실제 수행한 범위에 맞춰 보완하세요. 브랜드·콘텐츠·퍼포먼스·CRM에서 필요한 자료는 서로 다릅니다.</p><ul>{missing.map(chapter => <li key={chapter.key}><b>{chapter.label}</b><span>{chapter.missing}</span></li>)}</ul></aside>}
      {sections.length === 0 && !item.metrics.length && <p className="ma-empty">타깃을 선택한 이유, 직접 만든 작업물, 집행과 개선 기록을 연결해 주세요.</p>}
      </div>
    </div>
  </>;
}

export default function MarketerEvidenceCaseStudy({ sr = {}, sourceText, readOnly = false, onChange }) {
  const model = useMemo(() => buildMarketerEvidenceModel(sr, { sourceText: sourceText === undefined ? undefined : roleSourceText(sr, sourceText) }), [sr, sourceText]);
  const [active, setActive] = useState(0), id = useId();
  const selected = Math.min(active, Math.max(0, model.cases.length - 1));
  return <section className="mk-portfolio ma-portfolio" aria-label="마케터 핵심 경험 포트폴리오">
    <header className="ma-page-title"><div><span>MARKETING PORTFOLIO</span><h2>핵심 경험</h2></div><p>고객을 이해한 근거부터<br />직접 만든 작업과 결과까지</p></header>
    {model.cases.length ? <><div className="mk-case-tabs ma-case-tabs print:hidden" role="tablist" aria-label="캠페인 선택">{model.cases.map((item, i) => <button type="button" key={item.id} role="tab" id={id + '-tab-' + i} aria-selected={selected === i} aria-controls={id + '-case-' + i} tabIndex={selected === i ? 0 : -1} onClick={() => setActive(i)} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (i + 1) % model.cases.length : event.key === 'ArrowLeft' ? (i + model.cases.length - 1) % model.cases.length : event.key === 'Home' ? 0 : event.key === 'End' ? model.cases.length - 1 : null;
      if (next !== null) { event.preventDefault(); setActive(next); document.getElementById(id + '-tab-' + next)?.focus(); }
    }}><span>{String(i + 1).padStart(2, '0')}</span>{item.title}</button>)}</div>{model.cases.map((item, i) => <article className={'mk-campaign ma-case ' + (selected === i ? '' : 'mk-hidden')} role="tabpanel" id={id + '-case-' + i} aria-labelledby={id + '-tab-' + i} key={item.id}><Campaign item={item} sr={sr} onChange={onChange} readOnly={readOnly} /></article>)}</> : <p className="ma-empty">캠페인 브리프·직접 만든 작업물·운영 기록으로 첫 경험을 정리하세요.</p>}
    {!readOnly && <details className="mk-references print:hidden"><summary>구성에 참고한 공개 작업물·직무 자료 <ChevronDown size={13} /></summary><p>합격 공식이 아닙니다. 공개 작업물과 채용·실무 자료를 구분해 참고했으며, 공개 작업물이 실제 합격 제출본이라는 뜻은 아닙니다.</p>{[
      ['메가존 · 온라인마케터 합격자 후기 (원본 비공개)', 'https://www.jobkorea.co.kr/starter/review/view?C_Idx=7134&Ctgr_Code=4'],
      ['Carmine Mastropierro · 카피·콘텐츠 공개 작업물', 'https://carminemastropierro.com/portfolio/'],
      ['Converse Korea · 브랜드 마케팅 채용', 'https://careers.nike.com/professional-ii-brand-marketing-converse/job/R-89334'],
      ['채널톡 · DM 캠페인 실무 회고', 'https://docs.channel.io/team-blog/ko/articles/dm-marketing-lessons-learned-472ad18d'],
      ['IMSE · 세그먼트·이메일 운영 사례 (Mailchimp)', 'https://mailchimp.com/case-studies/imse-segmentation-strategy/'],
      ['Volkswagen · 온라인·오프라인 성과 측정 사례 (Google)', 'https://business.google.com/en-all/think/measurement/volkswagen-middle-east-lead-gen/'],
      ['airSlate · 이메일 마케팅 채용', 'https://jobs.lever.co/airslate/e279e0d7-cfbd-4035-bd81-45d4fccae261'],
      ['TodayTix · CRM 리더 채용', 'https://jobs.lever.co/todaytixgroup/6e90685e-0123-409b-b2d2-08f66fa4f149'],
    ].map(([label, url]) => <a key={url} href={url} target="_blank" rel="noreferrer"><b>{label}</b><ArrowUpRight size={13} /></a>)}</details>}

  </section>;
}
