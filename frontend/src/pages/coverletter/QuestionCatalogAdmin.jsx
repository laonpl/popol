import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { questionCatalogAPI } from '../../services/api';
import './coverLetter.css';
import './questionCatalogAdmin.css';

const initialForm = () => ({ company: '', position: '', sourceUrl: '', applicationUrl: '', sourceEvidenceUrl: '', validFrom: '', expiresAt: '', sourceQuestionText: '' });
const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } };
const errorText = error => error.response?.data?.error || error.message || '요청을 완료하지 못했습니다.';
const displayTime = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }); };
const kstIso = value => { const date = new Date(`${value}:00+09:00`); if (Number.isNaN(date.getTime())) throw new Error('모집 시작일과 마감일을 입력해주세요.'); return date.toISOString(); };

export default function QuestionCatalogAdmin() {
  const user = useAuthStore(s => s.user);
  const [data, setData] = useState({ entries: [], requests: [] });
  const [form, setForm] = useState(initialForm);
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState([]);
  const [originalVerified, setOriginalVerified] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState('load');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const identity = useRef(user?.uid);
  identity.current = user?.uid;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = uid => alive.current && identity.current === uid && useAuthStore.getState().user?.uid === uid;

  const load = async () => {
    const uid = user?.uid;
    if (!uid) return;
    setBusy('load'); setError('');
    try {
      const result = await questionCatalogAPI.list();
      if (current(uid)) { setData(result); setAllowed(true); }
    } catch (err) {
      if (current(uid)) { setError(errorText(err)); if ([401, 403].includes(err.response?.status)) { setAllowed(false); setData({ entries: [], requests: [] }); } }
    } finally { if (current(uid)) setBusy(''); }
  };
  useEffect(() => { setAllowed(false); setData({ entries: [], requests: [] }); setPreview(null); setForm(initialForm()); load(); }, [user?.uid]);
  const update = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setPreview(null); setConfirmed([]); setOriginalVerified(false); setNotice(''); };
  const payload = () => ({ ...form, validFrom: kstIso(form.validFrom), expiresAt: kstIso(form.expiresAt) });
  const inspect = async event => {
    event.preventDefault(); if (busy) return;
    const uid = user?.uid;
    setBusy('preview'); setError(''); setNotice('');
    try { const result = await questionCatalogAPI.preview(payload()); if (current(uid)) { setPreview(result.entry); setConfirmed([]); setOriginalVerified(false); } }
    catch (err) { if (current(uid)) setError(errorText(err)); }
    finally { if (current(uid)) setBusy(''); }
  };
  const publish = async () => {
    if (!preview || busy || !originalVerified || confirmed.length !== preview.questions.length) return;
    const uid = user?.uid;
    setBusy('publish'); setError('');
    try {
      await questionCatalogAPI.publish({ ...payload(), originalVerified: true, confirmedQuestionIds: confirmed });
      if (!current(uid)) return;
      setPreview(null); setConfirmed([]); setOriginalVerified(false); setForm(initialForm());
      setNotice('문항을 등록했습니다. 같은 공고와 직무를 조회하는 고객에게 자동으로 제공됩니다.');
      const refreshed = await questionCatalogAPI.list();
      if (current(uid)) setData(refreshed);
    } catch (err) { if (current(uid)) setError(errorText(err)); }
    finally { if (current(uid)) setBusy(''); }
  };
  const deactivate = async entry => {
    if (busy || !window.confirm(`${entry.company} · ${entry.position} 문항의 자동 제공을 중단할까요?`)) return;
    const uid = user?.uid;
    setBusy(entry.id); setError('');
    try { await questionCatalogAPI.deactivate(entry.id); const result = await questionCatalogAPI.list(); if (current(uid)) { setData(result); setNotice('문항 제공을 중단했습니다.'); } }
    catch (err) { if (current(uid)) setError(errorText(err)); }
    finally { if (current(uid)) setBusy(''); }
  };
  const populate = request => { setForm({ ...initialForm(), sourceUrl: request.sourceUrl, applicationUrl: request.applicationUrl }); setPreview(null); setConfirmed([]); setOriginalVerified(false); setError(''); setNotice('공고와 지원서를 확인하고 실제 문항 원문을 등록해주세요.'); document.getElementById('catalog-form')?.scrollIntoView({ behavior: 'smooth' }); };
  const link = (url, label) => safeUrl(url) && <a href={safeUrl(url)} target="_blank" rel="noreferrer">{label} <ExternalLink size={13} /></a>;

  return <main className="qc-admin">
    <header className="qc-heading"><div><Link to="/admin" className="cl-text-button"><ArrowLeft size={14} /> 관리자 홈</Link><p className="cl-eyebrow">지원서 문항 관리</p><h1>확인한 문항을 고객에게 바로 연결하세요.</h1><p>공고·직무·모집 기간별로 실제 문항을 관리합니다. 날짜는 한국 시간 기준입니다.</p></div><button className="cl-button" onClick={load} disabled={!!busy}><RefreshCw size={15} /> 새로고침</button></header>
    {!!error && <p className="cl-error" role="alert">{error}</p>}
    {!!notice && <p className="cl-notice" role="status">{notice}</p>}
    {busy === 'load' && !allowed && <div className="cl-panel"><Loader2 className="animate-spin" size={18} /> 관리자 권한을 확인하고 있습니다.</div>}
    {allowed && <>
      <section className="cl-panel"><h2>확인이 필요한 공고 <span>{data.requests?.length || 0}</span></h2><p>문항을 확보하지 못한 공고가 자동으로 모입니다. 고객의 경험과 답변은 이 목록에 저장하지 않습니다.</p>
        {!data.requests?.length ? <p className="cl-notice">대기 중인 확인 요청이 없습니다.</p> : <div className="qc-items">{data.requests.map(request => <article key={request.id}><div className="qc-links">{link(request.sourceUrl, '채용 공고')}{link(request.applicationUrl, '해당 직무 지원서')}</div><p>최근 조회 {displayTime(request.updatedAt)} · 조회 {request.count || 0}회</p><button className="cl-button" disabled={!!busy} onClick={() => populate(request)}>이 공고 문항 등록</button></article>)}</div>}
      </section>
      <section className="cl-panel" id="catalog-form"><h2>실제 지원서 문항 등록</h2><p>정상적으로 확인한 현재 지원서의 문항과 제한만 입력해주세요. 최대 12개 문항을 미리 확인한 뒤 등록합니다.</p>
        <form onSubmit={inspect}><fieldset disabled={!!busy} className="qc-fields"><div className="qc-grid">
          {[['company', '기업명', 'text'], ['position', '지원 직무', 'text'], ['sourceUrl', '채용 공고 URL', 'url'], ['applicationUrl', '선택한 직무의 지원 페이지 URL', 'url'], ['sourceEvidenceUrl', '문항을 확인한 실제 지원서 URL', 'url'], ['validFrom', '모집 시작일 · 한국 시간', 'datetime-local'], ['expiresAt', '모집 마감일 · 한국 시간', 'datetime-local']].map(([key, label, type]) => <label className="cl-field" key={key}>{label}<input required type={type} value={form[key]} maxLength={key.includes('Url') ? 2000 : 200} onChange={event => update(key, event.target.value)} /></label>)}
        </div><label className="cl-field">지원서의 실제 문항 원문<textarea required rows={8} maxLength={30000} value={form.sourceQuestionText} onChange={event => update('sourceQuestionText', event.target.value)} placeholder="문항 문구와 글자 수 제한을 그대로 입력해주세요. 지원자의 답변·이름·연락처는 입력하지 않습니다." /></label><button className="cl-button cl-button-dark" type="submit">{busy === 'preview' && <Loader2 size={15} className="animate-spin" />} 문항 미리 확인</button></fieldset></form>
        {preview && <div className="qc-preview"><h3>원본과 대조할 문항 {preview.questions.length}개</h3>{preview.questions.map((question, index) => <label className="qc-question" key={question.id}><input type="checkbox" checked={confirmed.includes(question.id)} onChange={event => setConfirmed(previous => event.target.checked ? [...previous, question.id] : previous.filter(id => id !== question.id))} disabled={!!busy} /><div><strong>{index + 1}. {question.question}</strong><p>{question.minLength ? `최소 ${question.minLength}자 · ` : ''}{question.maxLength ? `최대 ${question.maxLength}자` : '최대 글자 수 근거 없음'} · 공백 {question.countSpaces ? '포함' : '제외'}</p><blockquote>{question.sourceQuote}</blockquote></div></label>)}
          <label className="cl-checkbox"><input type="checkbox" checked={originalVerified} disabled={!!busy} onChange={event => setOriginalVerified(event.target.checked)} /> 해당 공고·직무의 현재 지원서 원본과 모든 문항·제한을 대조했습니다.</label>
          <button className="cl-button cl-button-dark" disabled={!!busy || !originalVerified || confirmed.length !== preview.questions.length} onClick={publish}><Check size={15} /> 검증 문항 등록</button>
        </div>}
      </section>
      <section className="cl-panel"><h2>등록한 문항 <span>{data.entries?.length || 0}</span></h2>{!data.entries?.length ? <p className="cl-notice">아직 등록한 문항이 없습니다.</p> : <div className="qc-items">{data.entries.map(entry => <article key={entry.id}><h3>{entry.company} · {entry.position}</h3><p>{entry.active ? Date.parse(entry.expiresAt) <= Date.now() ? '모집 마감' : Date.parse(entry.validFrom) > Date.now() ? '모집 예정' : '자동 제공 중' : '제공 중단'} · {entry.questions?.length}개 문항 · 마감 {displayTime(entry.expiresAt)}</p><div className="qc-links">{link(entry.sourceUrl, '채용 공고')}{link(entry.sourceEvidenceUrl, '지원서 원본')}</div><details><summary>문항 보기</summary>{entry.questions?.map(q => <p key={q.id}>{q.question} {q.maxLength ? `(${q.maxLength}자)` : ''}</p>)}</details>{entry.active && <button className="cl-button" onClick={() => deactivate(entry)} disabled={!!busy}>자동 제공 중단</button>}</article>)}</div>}</section>
    </>}
  </main>;
}
