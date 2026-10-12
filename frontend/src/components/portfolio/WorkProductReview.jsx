import { useEffect, useState } from 'react';
import { appendReviewedWorkProduct, updateReviewedWorkProduct } from '../../utils/roleProofMap';
import './RoleProofMaps.css';

const STAGES = [['unknown', '아직 구분하지 않음'], ['planned', '계획한 일'], ['executed', '직접 실행한 일'], ['observed', '결과를 관찰한 일'], ['changed', '개선을 반영한 일']];

function StageSelect({ value, onChange }) {
  return <label>수행 단계<select value={value || 'unknown'} onChange={event => onChange(event.target.value)}>{STAGES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>;
}

export function RoleWorkCapture({ sr, item, groups = [], role, onChange, defaultGroup = '', open = false }) {
  const initialKind = groups.some(entry => entry.key === defaultGroup) ? defaultGroup : groups.length === 1 ? groups[0].key : '';
  const contextKey = `${role}|${item.id || ''}|${item.sourceIndex}|${groups.map(entry => entry.key).join(',')}|${initialKind}`;
  const [kind, setKind] = useState(initialKind);
  const [draft, setDraft] = useState({});
  const [source, setSource] = useState('');
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(open);
  const group = groups.find(entry => entry.key === kind);
  const references = [...new Map((item.evidenceRows || []).filter(row => ['source_excerpt', 'self_report'].includes(row.basis) && row.quote?.length >= 12).map(row => [row.sourceName + '|' + row.quote, row])).values()];
  const sourceSignature = references.map(row => `${row.sourceName}|${row.quote}`).join('\n');
  const reference = source !== '' ? references[Number(source)] : null;
  const full = group && (item.workProducts?.[group.key] || []).length >= group.limit;

  useEffect(() => { setKind(initialKind); setDraft({}); setSource(''); setMessage(''); }, [contextKey]);
  useEffect(() => { setExpanded(Boolean(open)); }, [open, contextKey]);
  useEffect(() => { setSource(''); }, [sourceSignature]);

  if (!onChange || !groups.length) return null;
  const changeField = (field, value) => { setDraft(previous => ({ ...previous, [field]: value })); setMessage(''); };
  const save = event => {
    event.preventDefault();
    const next = appendReviewedWorkProduct(sr, item, role, group, draft, reference);
    if (next === sr) { setMessage('입력한 내용과 추가 가능한 개수를 확인해 주세요.'); return; }
    onChange(next);
    setDraft({}); setSource('');
    setMessage(`${group.label} 기록을 핵심 경험에 추가했습니다. 경험 저장을 누르면 보관됩니다.`);
  };

  return <details className="work-product-add" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>{defaultGroup || groups.length < 4 ? '이 단계의 내 작업 직접 기록하기' : '빠진 핵심 산출물 직접 정리'}</summary>
    <p>{role === 'pm' ? '내가 발견한 문제, 선택한 대안, 설계한 정책과 검증 결과를 구체적으로 남겨주세요.' : '내가 고른 고객, 실제 소재와 카피, 채널 운영과 관찰한 반응을 구체적으로 남겨주세요.'}</p>
    <label>추가할 산출물<select value={kind} onChange={event => { setKind(event.target.value); setDraft({}); setSource(''); setMessage(''); }}>
      <option value="">유형 선택</option>{groups.map(entry => <option key={entry.key} value={entry.key} disabled={(item.workProducts?.[entry.key] || []).length >= entry.limit}>{entry.label}{(item.workProducts?.[entry.key] || []).length >= entry.limit ? ' · 최대 개수 도달' : ''}</option>)}
    </select></label>
    {group && !full && <form onSubmit={save}>
      {group.description && <p>{group.description}</p>}
      <div className="work-product-add-fields">{group.fields.map(([field, label], index) => <label key={field}>{label}<textarea required={index === 0} rows={2} maxLength={600} value={draft[field] || ''} onChange={event => changeField(field, event.target.value)} /></label>)}</div>
      <StageSelect value={draft.stage} onChange={value => changeField('stage', value)} />
      <label>함께 참고할 연결 자료<select value={source} onChange={event => setSource(event.target.value)}><option value="">내 경험을 직접 기록</option>{references.map((row, index) => <option value={index} key={`${row.sourceName}|${row.quote}`}>{row.basis === 'self_report' ? '본인 진술' : row.sourceName} · {row.quote.slice(0, 40)}</option>)}</select></label>
      {reference && <blockquote>{reference.quote}</blockquote>}
      <p>입력한 내용은 본인 진술로 저장됩니다. 참고 자료를 선택하면 함께 연결됩니다.</p>
      <button type="submit">산출물 추가</button>
    </form>}
    {full && <p>이 산출물의 기록을 모두 채웠습니다. 아래의 내용 검토에서 기존 기록을 수정할 수 있습니다.</p>}
    {message && <p role="status">{message}</p>}
  </details>;
}

// Manual edits never manufacture a new source match. The original excerpt stays immutable.
export default function WorkProductReview({ sr, item, groups, role, onChange, id }) {
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState({});
  const [message, setMessage] = useState('');
  const entries = groups.flatMap(group => (item.workProducts?.[group.key] || []).map((row, index) => ({ group, row, index, id: `${group.key}:${index}` })));
  const current = entries.find(entry => entry.id === selected);
  useEffect(() => { setSelected(''); setDraft({}); setMessage(''); }, [role, item.id, item.sourceIndex]);
  if (!onChange) return null;
  const applyEdit = event => {
    event.preventDefault();
    const next = updateReviewedWorkProduct(sr, item, role, current.group, current.row.sourceRowIndex ?? current.index, draft);
    if (next === sr) { setMessage('수정할 내용을 입력해 주세요.'); return; }
    onChange(next); setSelected(''); setDraft({}); setMessage('수정한 내용을 적용했습니다. 경험을 저장해 주세요.');
  };
  const remove = () => {
    const key = role === 'pm' ? 'pmWorkProducts' : 'marketerWorkProducts';
    onChange({ ...sr, keyExperiences: sr.keyExperiences.map((experience, index) => index !== item.sourceIndex ? experience : { ...experience, jobData: { ...experience.jobData, [key]: { ...experience.jobData[key], [current.group.key]: experience.jobData[key][current.group.key].filter((row, ri) => ri !== (current.row.sourceRowIndex ?? current.index) || !row.manuallyAdded) } } }) });
    setSelected(''); setDraft({}); setMessage('직접 추가한 기록을 삭제했습니다. 경험을 저장해 주세요.');
  };
  return <div id={id} className="work-product-editor print:hidden">
    {entries.length > 0 && <details className="work-product-review">
      <summary>추출된 산출물 내용 검토 · 수정</summary>
      <p>직접 수행한 사실과 관찰한 내용을 정리해 주세요. 연결된 자료의 원문은 유지됩니다.</p>
      <label>수정할 산출물<select value={selected} onChange={event => { setSelected(event.target.value); setDraft({ ...(entries.find(entry => entry.id === event.target.value)?.row || {}) }); setMessage(''); }}><option value="">항목 선택</option>{entries.map(entry => <option key={entry.id} value={entry.id}>{entry.group.label} · {entry.index + 1}</option>)}</select></label>
      {current && <form onSubmit={applyEdit}>
        {current.group.fields.map(([field, label]) => <label key={field}>{label}<textarea value={draft[field] || ''} maxLength={600} rows={2} onChange={event => setDraft({ ...draft, [field]: event.target.value })} /></label>)}
        {current.row.manuallyAdded && <StageSelect value={draft.stage} onChange={stage => setDraft({ ...draft, stage })} />}
        <blockquote>{current.row.quote || '연결된 원문이 없습니다.'}</blockquote>
        <button type="submit">수정 적용</button>{current.row.manuallyAdded && <button type="button" className="work-product-remove" onClick={remove}>직접 추가한 초안 삭제</button>}
      </form>}
      {message && <p role="status">{message}</p>}
    </details>}
    <RoleWorkCapture sr={sr} item={item} groups={groups} role={role} onChange={onChange} />
  </div>;
}
