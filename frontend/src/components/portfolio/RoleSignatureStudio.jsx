import { useState } from 'react';
import { ArrowRight, FileCheck2, GitBranch, Megaphone, MousePointer2, Target } from 'lucide-react';
import { buildMarketingStudioStages, buildPmDecisionStages, stageEvidenceLabel } from '../../utils/roleSignatureModels';
import { PM_STAGE_LABELS } from '../../utils/pmEvidence';
import { MARKETER_STAGE_LABELS, METRIC_KINDS } from '../../utils/marketerEvidence';
import { Source as MarketingSource } from './MarketerWorkProductBlocks';
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

function PmChoices({ stage, selected, setSelected, Source }) {
  if (!stage.choices.length) return null;
  const isDecision = stage.key === 'decision';
  const isExecution = stage.key === 'execution';
  const row = stage.choices[Math.min(selected, stage.choices.length - 1)];
  return <div className="rs-pm-choices">
    <div className="rs-choices-heading"><GitBranch size={15} /><b>{isDecision ? '대안 비교' : isExecution ? '출시·협업 기록' : '서비스 흐름'}</b><small>{stage.choices.length}개 기록</small></div>
    <div className="rs-choice-rail" aria-label={isDecision ? '검토한 대안' : isExecution ? '출시와 협업' : '서비스 단계'}>{stage.choices.map((choice, index) => <button type="button" key={index} aria-pressed={selected === index} onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, '0')}</span><b>{isDecision ? choice.option || '대안' : isExecution ? choice.milestone || choice.stakeholder || '실행' : choice.step || '단계'}</b><small>{isDecision ? choice.disposition || '결정 미확인' : PM_STAGE_LABELS[choice.stage] || '단계 확인 필요'}</small></button>)}</div>
    <article className="rs-choice-detail"><h4>{isDecision ? row.option : isExecution ? row.milestone || row.stakeholder : row.step}</h4><div className="rs-detail-fields">{(isDecision
      ? [['disposition', '결정'], ['criterion', '판단 기준'], ['tradeoff', '얻는 것과 감수한 제약'], ['reason', '선택·제외 이유']]
      : isExecution ? [['scope', '출시 범위'], ['dependency', '선행 조건'], ['gate', '출시·인수 기준'], ['status', '기록된 상태'], ['disagreement', '이견'], ['myAction', '내 조율'], ['agreement', '합의']]
      : [['customerAction', '고객 행동'], ['actor', '행동 주체'], ['before', '기존 흐름'], ['after', '바뀐 흐름'], ['frontstage', '고객 접점'], ['backstage', '운영'], ['system', '시스템'], ['exception', '예외 처리']])
      .filter(([key]) => row[key]).map(([key, label]) => <div key={key}><small>{label}</small><p>{row[key]}</p></div>)}</div><Source record={row} /></article>
  </div>;
}

export function PmDecisionStudio({ item, Source, sourcesId, canEdit }) {
  const [active, setActive] = useState('discovery');
  const [selectedChoice, setSelectedChoice] = useState(0);
  const stages = buildPmDecisionStages(item);
  const current = stages.find(entry => entry.key === active) || stages[0];
  const setStage = key => { setActive(key); setSelectedChoice(0); };
  return <section className="rs-studio rs-pm print:hidden" aria-label="제품 의사결정 지도">
    <header><div><span>PRODUCT DECISION MAP</span><h3>제품 의사결정 지도</h3><p>문제의 신호부터 선택·설계·검증까지, 어떤 근거로 결정을 바꿨는지 살펴보세요.</p></div><FileCheck2 size={22} /></header>
    <div className="rs-pm-layout"><nav aria-label="의사결정 단계" className="rs-pm-nav">{stages.map((entry, index) => <button key={entry.key} type="button" aria-pressed={current.key === entry.key} onClick={() => setStage(entry.key)}><span>{String(index + 1).padStart(2, '0')}</span><b>{entry.label}</b><small>{stageEvidenceLabel(entry)}</small><ArrowRight size={15} /></button>)}</nav>
      <div className="rs-pm-panel"><div className="rs-panel-head"><span>{current.label}</span><h4>{current.title}</h4></div>{current.fields.length ? <FieldGrid fields={current.fields} role="pm" Source={Source} /> : <Missing prompt={current.prompt} link={sourcesId} canEdit={canEdit} />}
        {(current.key === 'decision' || current.key === 'design' || current.key === 'execution') && <PmChoices stage={current} selected={selectedChoice} setSelected={setSelectedChoice} Source={Source} />}
        {current.key === 'validation' && item.metrics.length > 0 && <div className="rs-metric-ledger"><b>제품 지표</b>{item.metrics.map((metric, index) => <div key={index}><span>{metric.name}</span><small>기준 {metric.baseline || '미기록'}</small><ArrowRight size={13} /><strong>{metric.actual || '실측 미확인'}</strong><small>목표 {metric.target || '미기록'}</small><Source record={metric} /></div>)}</div>}
        {canEdit && <a className="rs-edit-link" href={`#${sourcesId}`}>정책·대안·검증 기록 추가 또는 수정 <ArrowRight size={13} /></a>}
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
    <div className="rs-marketing-choices" aria-label={creative ? '소재 선택' : lifecycle ? '콘텐츠와 CRM 선택' : '채널 선택'}>{stage.choices.map((choice, index) => <button type="button" key={index} aria-pressed={selected === index} onClick={() => setSelected(index)}>{creative ? choice.variant || choice.format || `소재 ${index + 1}` : lifecycle ? choice.segment || choice.pillar || `운영 ${index + 1}` : choice.channel || `채널 ${index + 1}`}</button>)}</div>
    <article className="rs-marketing-detail">{creative ? <><small>{row.format || '소재 형식 미기록'}</small><h4>{row.hook || row.variant}</h4>{row.message && <p className="rs-copy">{row.message}</p>}{row.cta && <span className="rs-cta">CTA · {row.cta}</span>}<div className="rs-detail-fields">{row.rationale && <div><small>왜 이 표현인가</small><p>{row.rationale}</p></div>}{row.observation && <div><small>관찰한 반응</small><p>{row.observation}</p></div>}</div></>
      : lifecycle ? <><small>{content ? '콘텐츠 운영' : 'CRM 여정'}</small><h4>{content ? row.pillar : row.segment}</h4><div className="rs-channel-handoff"><span>{content ? row.intent || '독자 의도 미기록' : row.trigger || '진입 조건 미기록'}</span><ArrowRight size={16} /><span>{content ? row.format || '형식 미기록' : row.message || '메시지 미기록'}</span><ArrowRight size={16} /><span>{content ? row.distribution || '배포 경로 미기록' : row.exit || '종료 조건 미기록'}</span></div><div className="rs-detail-fields">{(content ? [['cadence', '발행 주기'], ['reuse', '재활용 구조']] : [['timing', '발송 시점'], ['guardrail', '빈도·고객 보호']]).filter(([key]) => row[key]).map(([key, label]) => <div key={key}><small>{label}</small><p>{row[key]}</p></div>)}</div></>
      : <><small>{MARKETER_STAGE_LABELS[row.stage] || '단계 확인 필요'}</small><h4>{row.channel}</h4><div className="rs-channel-handoff"><span>{row.audience || '대상 미기록'}</span><ArrowRight size={16} /><span>{row.purpose || '채널 역할 미기록'}</span><ArrowRight size={16} /><span>{row.handoff || '다음 접점 미기록'}</span></div><div className="rs-detail-fields">{row.rationale && <div><small>채널 선택 근거</small><p>{row.rationale}</p></div>}{row.period && <div><small>기간</small><p>{row.period}</p></div>}</div></>}
      <MarketingSource row={row} /></article>
  </div>;
}

export function MarketingCampaignStudio({ item, reviewId, canEdit }) {
  const [active, setActive] = useState('audience');
  const [selectedChoice, setSelectedChoice] = useState(0);
  const stages = buildMarketingStudioStages(item);
  const current = stages.find(entry => entry.key === active) || stages[0];
  const setStage = key => { setActive(key); setSelectedChoice(0); };
  return <section className="rs-studio rs-marketing print:hidden" aria-label="캠페인 전략과 실행 흐름">
    <header><div><span>CAMPAIGN CONTROL ROOM</span><h3>캠페인 전략·실행 보드</h3><p>누구에게 어떤 메시지를 보냈고, 채널을 거쳐 어떤 반응을 확인했는지 살펴보세요.</p></div><Target size={23} /></header>
    <nav className="rs-marketing-nav" aria-label="캠페인 단계">{stages.map((entry, index) => <button type="button" key={entry.key} aria-pressed={current.key === entry.key} onClick={() => setStage(entry.key)}><small>{String(index + 1).padStart(2, '0')}</small><b>{entry.label}</b><span>{stageEvidenceLabel(entry)}</span></button>)}</nav>
    <div className="rs-marketing-panel"><div className="rs-panel-head"><span>{current.label}</span><h4>{current.title}</h4></div>{current.fields.length ? <FieldGrid fields={current.fields} role="marketer" /> : <Missing prompt={current.prompt} link={reviewId} canEdit={canEdit} />}
      {(current.key === 'creative' || current.key === 'activation' || current.key === 'lifecycle') && <MarketingChoices stage={current} selected={selectedChoice} setSelected={setSelectedChoice} />}
      {current.key === 'measurement' && item.metrics.length > 0 && <div className="rs-metric-ledger"><b>반응·제작량 기록</b>{item.metrics.map((metric, index) => <div key={index}><span>{metric.name}<small>{METRIC_KINDS[metric.kind]}</small></span><small>기준 {metric.baseline || '미기록'}</small><ArrowRight size={13} /><strong>{metric.actual || '실측 미확인'}</strong><small>목표 {metric.target || '미기록'}</small><MarketingSource row={metric} /></div>)}</div>}
      {canEdit && <a className="rs-edit-link" href={`#${reviewId}`}>소재·채널·측정 기록 추가 또는 수정 <ArrowRight size={13} /></a>}
    </div>
  </section>;
}
