import { useState } from 'react';
import { ArrowRight, FileCheck2, GitBranch, Megaphone, MousePointer2, Target } from 'lucide-react';
import { buildMarketingStudioStages, buildPmDecisionStages, ROLE_STAGE_GROUPS, stageRecordLabel } from '../../utils/roleSignatureModels';
import { PM_STAGE_LABELS } from '../../utils/pmEvidence';
import { MARKETER_STAGE_LABELS, METRIC_KINDS } from '../../utils/marketerEvidence';
import { PM_WORK_PRODUCTS } from '../../utils/pmWorkProducts';
import { MARKETER_WORK_PRODUCTS } from '../../utils/marketerWorkProducts';
import { Source as MarketingSource } from './MarketerWorkProductBlocks';
import { RoleWorkCapture } from './WorkProductReview';
import './RoleSignatureStudio.css';

const proofLabel = row => row?.basis === 'source_excerpt' ? '원문 연결' : row?.basis === 'self_report' ? '본인 진술' : '원문 확인 필요';

function FieldGrid({ fields, role, Source }) {
  return <div className="rs-fields">{fields.map(({ label, value, source }, index) => <div key={`${label}-${index}`}>
    <small>{label}</small><p>{value}</p>{source && <span className={source.basis === 'source_excerpt' ? 'rs-verified' : 'rs-unverified'}>{proofLabel(source)}</span>}
    {source && role === 'pm' && <Source record={source} />}{source && role === 'marketer' && <MarketingSource row={source} />}
  </div>)}</div>;
}

function Missing({ prompt, link, canEdit }) {
  return <div className="rs-missing"><p>{prompt}</p>{canEdit && <a href={`#${link}`}>내 작업 직접 기록하기 <ArrowRight size={13} /></a>}</div>;
}

function StageCapture({ sr, item, role, stage, onChange }) {
  const keys = ROLE_STAGE_GROUPS[role]?.[stage.key] || [];
  const catalog = role === 'pm' ? PM_WORK_PRODUCTS : MARKETER_WORK_PRODUCTS;
  const groups = keys.map(key => catalog.find(group => group.key === key)).filter(Boolean);
  const defaultGroup = groups.find(group => (item.workProducts[group.key] || []).length < group.limit)?.key || groups[0]?.key;
  return <div className="rs-stage-capture"><RoleWorkCapture key={`${item.id}-${stage.key}`} sr={sr} item={item} groups={groups} role={role} onChange={onChange} defaultGroup={defaultGroup} /></div>;
}

function moveStage(event, stages, index, select) {
  const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % stages.length
    : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index + stages.length - 1) % stages.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? stages.length - 1 : null;
  if (next === null) return;
  event.preventDefault();
  select(stages[next].key);
  event.currentTarget.parentElement.querySelectorAll('button')[next]?.focus();
}

function PmChoices({ stage, selected, setSelected, Source }) {
  if (!stage.choices.length) return null;
  const isDecision = stage.key === 'decision';
  const isExecution = stage.key === 'execution';
  const row = stage.choices[Math.min(selected, stage.choices.length - 1)];
  return <div className="rs-pm-choices">
    <div className="rs-choices-heading"><GitBranch size={15} /><b>{isDecision ? '대안 비교' : isExecution ? '출시·협업 기록' : '서비스 흐름'}</b><small>{stage.choices.length}개 기록</small></div>
    {isDecision ? <div className="rs-decision-table-wrap"><table className="rs-decision-table"><caption>대안별 선택 기준과 감수한 제약</caption><thead><tr><th scope="col">검토한 대안</th><th scope="col">판단 기준</th><th scope="col">얻는 것 · 감수한 제약</th><th scope="col">결정</th></tr></thead><tbody>{stage.choices.map((choice, index) => <tr key={index} data-selected={selected === index}><th scope="row"><button type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{choice.option || '대안'}</button></th><td>{choice.criterion || '미기록'}</td><td>{choice.tradeoff || choice.reason || '미기록'}</td><td><span data-adopted={choice.disposition === '채택'}>{choice.disposition || '미기록'}</span></td></tr>)}</tbody></table></div>
      : <div className="rs-choice-rail" aria-label={isExecution ? '출시와 협업' : '서비스 단계'}>{stage.choices.map((choice, index) => <button type="button" key={index} aria-pressed={selected === index} onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, '0')}</span><b>{isExecution ? choice.milestone || choice.stakeholder || '실행' : choice.step || '단계'}</b><small>{PM_STAGE_LABELS[choice.stage] || '단계 확인 필요'}</small></button>)}</div>}
    <article className="rs-choice-detail"><h4>{isDecision ? row.option : isExecution ? row.milestone || row.stakeholder : row.step}</h4><div className="rs-detail-fields">{(isDecision
      ? [['disposition', '결정'], ['criterion', '판단 기준'], ['tradeoff', '얻는 것과 감수한 제약'], ['reason', '선택·제외 이유']]
      : isExecution ? [['scope', '출시 범위'], ['dependency', '선행 조건'], ['gate', '출시·인수 기준'], ['status', '기록된 상태'], ['disagreement', '이견'], ['myAction', '내 조율'], ['agreement', '합의']]
      : [['customerAction', '고객 행동'], ['actor', '행동 주체'], ['before', '기존 흐름'], ['after', '바뀐 흐름'], ['frontstage', '고객 접점'], ['backstage', '운영'], ['system', '시스템'], ['exception', '예외 처리']])
      .filter(([key]) => row[key]).map(([key, label]) => <div key={key}><small>{label}</small><p>{row[key]}</p></div>)}</div><Source record={row} /></article>
  </div>;
}

export function PmDecisionStudio({ item, Source, sourcesId, canEdit, sr, onChange }) {
  const [active, setActive] = useState('discovery');
  const [selectedChoice, setSelectedChoice] = useState(0);
  const stages = buildPmDecisionStages(item);
  const current = stages.find(entry => entry.key === active) || stages[0];
  const summaryFields = current.fields.filter(field => !current.choices.includes(field.source));
  const setStage = key => { setActive(key); setSelectedChoice(0); };
  return <section className="rs-studio rs-pm print:hidden" aria-label="제품 의사결정 지도">
    <header><div><span>PRODUCT DECISION MAP</span><h3>제품 의사결정 지도</h3><p>사용자 관찰 → 선택과 포기 → 정책·흐름 → 출시 → 검증. 각 단계에서 내가 내린 결정과 이유를 기록하세요.</p></div><FileCheck2 size={22} /></header>
    <div className="rs-pm-layout"><nav aria-label="의사결정 단계" className="rs-pm-nav">{stages.map((entry, index) => <button key={entry.key} type="button" aria-pressed={current.key === entry.key} onClick={() => setStage(entry.key)} onKeyDown={event => moveStage(event, stages, index, setStage)}><span>{String(index + 1).padStart(2, '0')}</span><b>{entry.label}</b><small>{stageRecordLabel(item, 'pm', entry)}</small><ArrowRight size={15} /></button>)}</nav>
      <div className="rs-pm-panel"><div className="rs-panel-head"><span>{current.label}</span><h4>{current.title}</h4></div>{summaryFields.length ? <FieldGrid fields={summaryFields} role="pm" Source={Source} /> : !current.choices.length && <Missing prompt={current.prompt} link={sourcesId} canEdit={canEdit} />}
        {(current.key === 'decision' || current.key === 'design' || current.key === 'execution') && <PmChoices stage={current} selected={selectedChoice} setSelected={setSelectedChoice} Source={Source} />}
        {current.key === 'validation' && item.metrics.length > 0 && <div className="rs-metric-ledger"><b>제품 지표</b>{item.metrics.map((metric, index) => <div key={index}><span>{metric.name}</span><small>기준 {metric.baseline || '미기록'}</small><ArrowRight size={13} /><strong>{metric.actual || '실측 미확인'}</strong><small>목표 {metric.target || '미기록'}</small><Source record={metric} /></div>)}</div>}
        {canEdit && onChange && <StageCapture sr={sr} item={item} role="pm" stage={current} onChange={onChange} />}
        {canEdit && <a className="rs-edit-link" href={`#${sourcesId}`}>전체 산출물 수정 · 원본 자료 연결 <ArrowRight size={13} /></a>}
      </div>
    </div>
  </section>;
}

function MarketingChoices({ stage, selected, setSelected }) {
  if (!stage.choices.length) return null;
  const creative = stage.key === 'creative';
  const lifecycle = stage.key === 'lifecycle';
  const row = stage.choices[Math.min(selected, stage.choices.length - 1)];
  const content = lifecycle && Object.hasOwn(row, 'pillar');
  return <div className={creative ? 'rs-creative-inspector' : 'rs-channel-inspector'}>
    <div className="rs-choices-heading">{creative ? <Megaphone size={15} /> : <MousePointer2 size={15} />}<b>{creative ? '소재·카피 작업물' : lifecycle ? '지속 운영 규칙' : '채널 운영 설계'}</b><small>{stage.choices.length}개 기록</small></div>
    {!creative && !lifecycle ? <div className="rs-channel-map" aria-label="채널별 고객 이동 경로">{stage.choices.map((choice, index) => <button type="button" key={index} aria-pressed={selected === index} onClick={() => setSelected(index)}><span><small>채널 · 대상</small><b>{choice.channel || '채널 미기록'}</b><em>{choice.audience || '대상 미기록'}</em></span><ArrowRight size={15} /><span><small>이 접점의 역할</small>{choice.purpose || '미기록'}</span><ArrowRight size={15} /><span><small>다음 행동 · 접점</small>{choice.handoff || '미기록'}</span></button>)}</div>
      : <div className="rs-marketing-choices" aria-label={creative ? '소재 선택' : '콘텐츠와 CRM 선택'}>{stage.choices.map((choice, index) => <button type="button" key={index} aria-pressed={selected === index} onClick={() => setSelected(index)}>{creative ? choice.variant || choice.format || `소재 ${index + 1}` : `${Object.hasOwn(choice, 'pillar') ? '콘텐츠' : 'CRM'} · ${choice.segment || choice.pillar || `운영 ${index + 1}`}`}</button>)}</div>}
    <article className="rs-marketing-detail">{creative ? <><small>{row.format || '소재 형식 미기록'}</small><h4>{row.hook || row.variant}</h4>{row.message && <p className="rs-copy">{row.message}</p>}{row.cta && <span className="rs-cta">CTA · {row.cta}</span>}<div className="rs-detail-fields">{row.rationale && <div><small>왜 이 표현인가</small><p>{row.rationale}</p></div>}{row.observation && <div><small>관찰한 반응</small><p>{row.observation}</p></div>}</div></>
      : lifecycle ? <><small>{content ? '콘텐츠 운영' : 'CRM 여정'}</small><h4>{content ? row.pillar : row.segment}</h4><div className="rs-channel-handoff"><span>{content ? row.intent || '독자 의도 미기록' : row.trigger || '진입 조건 미기록'}</span><ArrowRight size={16} /><span>{content ? row.format || '형식 미기록' : row.message || '메시지 미기록'}</span><ArrowRight size={16} /><span>{content ? row.distribution || '배포 경로 미기록' : row.exit || '종료 조건 미기록'}</span></div><div className="rs-detail-fields">{(content ? [['cadence', '발행 주기'], ['reuse', '재활용 구조']] : [['timing', '발송 시점'], ['guardrail', '빈도·고객 보호']]).filter(([key]) => row[key]).map(([key, label]) => <div key={key}><small>{label}</small><p>{row[key]}</p></div>)}</div></>
      : <><small>{MARKETER_STAGE_LABELS[row.stage] || '단계 확인 필요'}</small><h4>{row.channel}</h4><div className="rs-detail-fields">{row.rationale && <div><small>채널 선택 근거</small><p>{row.rationale}</p></div>}{row.period && <div><small>기간</small><p>{row.period}</p></div>}{row.budget && <div><small>기록된 예산</small><p>{row.budget}</p></div>}</div></>}
      <MarketingSource row={row} /></article>
  </div>;
}

export function MarketingCampaignStudio({ item, reviewId, canEdit, sr, onChange }) {
  const [active, setActive] = useState('audience');
  const [selectedChoice, setSelectedChoice] = useState(0);
  const stages = buildMarketingStudioStages(item);
  const current = stages.find(entry => entry.key === active) || stages[0];
  const summaryFields = current.fields.filter(field => !current.choices.includes(field.source));
  const setStage = key => { setActive(key); setSelectedChoice(0); };
  return <section className="rs-studio rs-marketing print:hidden" aria-label="캠페인 전략과 실행 흐름">
    <header><div><span>CAMPAIGN CONTROL ROOM</span><h3>캠페인 전략·실행 보드</h3><p>타깃과 메시지, 만든 소재, 채널별 접점, 실험 결과를 연결하세요. 실제로 맡은 작업부터 채울 수 있습니다.</p></div><Target size={23} /></header>
    <nav className="rs-marketing-nav" aria-label="캠페인 단계">{stages.map((entry, index) => <button type="button" key={entry.key} aria-pressed={current.key === entry.key} onClick={() => setStage(entry.key)} onKeyDown={event => moveStage(event, stages, index, setStage)}><small>{String(index + 1).padStart(2, '0')}</small><b>{entry.label}</b><span>{stageRecordLabel(item, 'marketer', entry)}</span></button>)}</nav>
    <div className="rs-marketing-panel"><div className="rs-panel-head"><span>{current.label}</span><h4>{current.title}</h4></div>{summaryFields.length ? <FieldGrid fields={summaryFields} role="marketer" /> : !current.choices.length && <Missing prompt={current.prompt} link={reviewId} canEdit={canEdit} />}
      {(current.key === 'creative' || current.key === 'activation' || current.key === 'lifecycle') && <MarketingChoices stage={current} selected={selectedChoice} setSelected={setSelectedChoice} />}
      {current.key === 'measurement' && item.metrics.length > 0 && <div className="rs-metric-ledger"><b>반응·제작량 기록</b>{item.metrics.map((metric, index) => <div key={index}><span>{metric.name}<small>{METRIC_KINDS[metric.kind]}</small></span><small>기준 {metric.baseline || '미기록'}</small><ArrowRight size={13} /><strong>{metric.actual || '실측 미확인'}</strong><small>목표 {metric.target || '미기록'}</small><MarketingSource row={metric} /></div>)}</div>}
      {canEdit && onChange && <StageCapture sr={sr} item={item} role="marketer" stage={current} onChange={onChange} />}
      {canEdit && <a className="rs-edit-link" href={`#${reviewId}`}>전체 산출물 수정 · 원문 확인 <ArrowRight size={13} /></a>}
    </div>
  </section>;
}
