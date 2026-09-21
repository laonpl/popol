import { useMemo, useState } from 'react';
import { FileText, ChevronDown, MessageSquare, Search, PenLine } from 'lucide-react';
import { buildPmEvidenceModel, PM_BASIS_LABELS } from '../../utils/pmEvidence';
import './PmEvidenceCaseStudy.css';
import PmPortfolioBoard from './PmPortfolioBoard';
import RoleArtifactStudio from './RoleArtifactStudio';
import WorkProductReview from './WorkProductReview';
import { PM_WORK_PRODUCTS } from '../../utils/pmWorkProducts';
import { roleSourceText } from '../../utils/roleArtifacts';

function SourceExcerpt({ record }) {
  const located = record.basis !== 'unlocated';
  const [open, setOpen] = useState(false);
  return (
    <div className={`pm-proof-source ${located ? '' : 'needs-source'}`}>
      {located ? <><button className="pm-proof-source-toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}><span className="pm-proof-basis">{record.basis === 'source_excerpt' ? <FileText size={13} /> : <MessageSquare size={13} />}{record.sourceName || PM_BASIS_LABELS[record.basis]}</span><span>{open ? '원문 접기' : '원문 확인'}<ChevronDown size={13} /></span></button><div className={open ? 'pm-proof-source-body' : 'pm-proof-source-body pm-source-collapsed'}><blockquote>{record.quote}</blockquote><p>{PM_BASIS_LABELS[record.basis]}{record.location ? ` · ${record.location}` : ''}</p></div></> : <p className="pm-proof-unlocated"><Search size={13} />{record.missingEvidence || '이 판단을 뒷받침할 원문이 아직 연결되지 않았습니다.'}</p>}
    </div>
  );
}

function Claim({ record, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(record.claim);
  if (editing) return <div className="pm-claim-editor print:hidden"><label>내 판단과 실행<textarea autoFocus value={draft} onChange={event => setDraft(event.target.value)} rows={4} /></label><p>요약만 수정합니다. 연결된 원문은 바뀌지 않으니 의미가 일치하는지 확인하세요.</p><div><button type="button" onClick={() => setEditing(false)}>취소</button><button type="button" disabled={!draft.trim()} onClick={() => { onSave(draft.trim()); setEditing(false); }}>적용</button></div></div>;
  return <div className="pm-claim-heading"><h4>{record.claim}</h4>{onSave && <button type="button" className="pm-claim-edit print:hidden" aria-label="판단 요약 수정" onClick={() => { setDraft(record.claim); setEditing(true); }}><PenLine size={14} /></button>}</div>;
}

export default function PmEvidenceCaseStudy({ sr = {}, sourceText, readOnly = false, onRecordChange, onChange }) {
  const model = useMemo(() => buildPmEvidenceModel(sr, { sourceText: sourceText === undefined ? undefined : roleSourceText(sr, sourceText) }), [sr, sourceText]);
  return <PmPortfolioBoard model={model} Source={SourceExcerpt} readOnly={readOnly}
    renderArtifacts={item => <>
      <RoleArtifactStudio sr={sr} item={item} onChange={onChange} readOnly={readOnly} />
      {!readOnly && <WorkProductReview sr={sr} item={item} groups={PM_WORK_PRODUCTS} role="pm" onChange={onChange} />}
    </>}
    renderRecord={(item, record) => <>
      <Claim record={record} onSave={!readOnly && onRecordChange && !record.derivedLegacy ? value => onRecordChange(item.sourceIndex, record.sourceRecordIndex, value) : undefined} />
      {record.ownership && <p className="pm-proof-ownership">내 기여 · {record.ownership}</p>}
      {record.userEdited && <p className="pd-record-caution">직접 수정한 요약 · 원문과 의미 대조 필요</p>}
      {record.limitation && <p className="pd-record-caution">해석의 한계 · {record.limitation}</p>}
      <SourceExcerpt record={record} />
    </>}
  />;
}
