import { useState } from 'react';
import { ArrowUpRight, FileText, Image, Link2, Plus } from 'lucide-react';
import { roleArtifacts, caseArtifacts, patchArtifactBinding } from '../../utils/roleArtifacts';
import './RoleArtifactStudio.css';

function ArtifactCard({ file, onEdit, onHide }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ caption: file.caption, contribution: file.contribution, purpose: file.purpose });
  const [failed, setFailed] = useState(false);
  return <article className="role-artifact-card">
    <a className={`role-artifact-preview ${file.image && !failed ? 'is-image' : ''}`} href={file.url} target="_blank" rel="noreferrer" aria-label={`${file.name} 원본 열기`}>
      {file.image && !failed ? <img src={file.url} alt={file.caption || file.name} loading="lazy" onError={() => setFailed(true)} /> : <><FileText size={32} /><span>{failed ? '미리보기를 불러오지 못했습니다' : file.kind === 'link' ? '연결된 원본 페이지' : (file.ext || 'DOCUMENT').toUpperCase()}</span></>}<span className="role-artifact-open"><ArrowUpRight size={15} />원본 열기</span>
    </a>
    <div className="role-artifact-caption"><small>{file.automatic ? '출처명 일치로 연결' : '직접 연결한 자료'}{file.purpose && ` · ${file.purpose}`}</small><h5>{file.name}</h5>{file.caption && <p>{file.caption}</p>}{file.contribution && <p className="role-artifact-contribution">내 작업 범위 · {file.contribution}<small>직접 입력</small></p>}
      {onEdit && <div className="role-artifact-tools print:hidden"><button type="button" onClick={() => { setDraft({ caption: file.caption, contribution: file.contribution, purpose: file.purpose }); setEditing(!editing); }}>설명 · 기여 작성</button><button type="button" onClick={onHide}>이 경험에서 숨기기</button></div>}
      {editing && <form className="role-artifact-form print:hidden" onSubmit={event => { event.preventDefault(); onEdit(draft); setEditing(false); }}>{[['purpose', '어떤 판단을 보여주나요?'], ['caption', '산출물에서 봐야 할 부분'], ['contribution', '내가 직접 작성·결정한 범위']].map(([key, label]) => <label key={key}>{label}<textarea rows={2} maxLength={600} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}<p>파일 연결과 설명은 작성자 진술이며, 성과 검증이나 저작권 확인을 의미하지 않습니다.</p><button type="submit">설명 적용</button></form>}
    </div>
  </article>;
}

export default function RoleArtifactStudio({ sr = {}, item, role = 'pm', onChange, readOnly }) {
  const [choosing, setChoosing] = useState(false);
  const files = roleArtifacts(sr), selected = caseArtifacts(sr, item);
  const available = files.filter(file => !selected.some(current => current.id === file.id));
  const editable = !readOnly && !!onChange;
  const change = (id, patch) => onChange(patchArtifactBinding(sr, item.sourceIndex, id, patch));
  return <section className="role-artifact-studio" aria-label="핵심 경험 원본 산출물">
    <header><div><span>{role === 'pm' ? 'CASE EVIDENCE' : 'WORK SAMPLES'}</span><h4>{role === 'pm' ? '이 경험의 근거 자료' : '캠페인 작업물과 원본'}</h4></div>{editable && <button className="print:hidden" type="button" aria-expanded={choosing} onClick={() => setChoosing(!choosing)}><Plus size={14} />자료 연결</button>}</header>
    {role === 'pm' && <p className="pd-evidence-help">앞선 문제·결정·설계·검증을 뒷받침하는 원본입니다. 자료에서 봐야 할 부분과 내가 작성한 범위를 함께 설명하세요. 파일 연결만으로 구현·출시가 확인되지는 않습니다.</p>}
    {selected.length ? <div className="role-artifact-grid">{selected.map(file => <ArtifactCard key={file.id} file={file} onEdit={editable ? patch => change(file.id, { ...patch, hidden: false }) : undefined} onHide={() => change(file.id, { hidden: true })} />)}</div> : <div className="role-artifact-empty"><Image size={23} /><p>{role === 'pm' ? '화면 설계·정책서·리서치·실험 리포트의 원본을 이 경험에 연결하세요.' : '광고 시안·랜딩 페이지·콘텐츠·CRM 메시지·성과 리포트를 이 캠페인에 연결하세요.'}<small>{role === 'pm' ? '연결된 원본 파일은 아직 없습니다. 각 문단의 ‘원문 확인’에서는 추출에 사용한 발췌를 볼 수 있습니다.' : '아래 추출 내용과 원본을 나란히 확인할 수 있습니다. 파일이 없다고 가상 산출물을 만들지는 않습니다.'}</small></p></div>}
    {choosing && editable && <div className="role-artifact-picker print:hidden"><p>기존 보관함에서 이 경험에 해당하는 자료만 선택하세요. 원본 파일은 삭제되지 않습니다.</p>{available.length ? available.map(file => <button type="button" key={file.id} onClick={() => change(file.id, { hidden: false })}><Link2 size={14} /><span>{file.name}</span><Plus size={14} /></button>) : <p>{files.length ? '모든 자료가 연결되어 있습니다.' : role === 'marketer' ? '경험정리 페이지 상단 ‘프로젝트 정보 · 자료 보관함’에서 파일 또는 링크를 추가하세요.' : '먼저 경험정리 페이지 좌측 산출물 보관함에 파일 또는 링크를 추가하세요.'}</p>}</div>}
  </section>;
}
