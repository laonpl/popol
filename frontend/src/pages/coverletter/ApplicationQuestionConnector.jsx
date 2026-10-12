import { useEffect, useRef, useState } from 'react';
import { Check, Download, ExternalLink, Link2, Loader2, X } from 'lucide-react';
import {
  CONNECTOR_DOWNLOAD_URL, connectionTarget, supportsApplicationConnector,
  loadConnectorConfig, newApplicationConnection, sendConnectorMessage, validateApplicationCapture,
} from '../../utils/applicationConnector';

export default function ApplicationQuestionConnector({ analysis, selectedUrl, company, position, disabled, onImport, onClose }) {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [capture, setCapture] = useState(null);
  const [selected, setSelected] = useState([]);
  const [importing, setImporting] = useState(false);
  const connectionRef = useRef(null);
  const pollRef = useRef(null);
  const liveRef = useRef(true);
  const startVersionRef = useRef(0);
  const panelRef = useRef(null);
  const supported = supportsApplicationConnector();
  let target = null, targetError = '';
  try { target = connectionTarget(analysis, selectedUrl); } catch (failure) { targetError = failure.message; }

  const stop = () => {
    startVersionRef.current += 1;
    clearTimeout(pollRef.current);
    const connection = connectionRef.current;
    connectionRef.current = null;
    if (connection) sendConnectorMessage(connection.extensionId, { type: 'FITPOLY_CANCEL', nonce: connection.nonce }).catch(() => {});
  };

  useEffect(() => {
    liveRef.current = true;
    loadConnectorConfig().then(value => { if (liveRef.current) setConfig(value); })
      .catch(failure => { if (liveRef.current) setError(failure.message); });
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return () => { liveRef.current = false; stop(); };
  }, []);

  useEffect(() => {
    stop();
    setStatus('idle');
    setCapture(null);
    setSelected([]);
    setError('');
  }, [selectedUrl, analysis?.selectedApplicationUrl, analysis?.sourceUrl]);

  const start = async () => {
    if (!target || !config || disabled) return;
    stop();
    const version = startVersionRef.current;
    setError('');
    setCapture(null);
    setStatus('connecting');
    const connection = { ...newApplicationConnection(target, { company, position }), extensionId: config.extensionId };
    connectionRef.current = connection;
    try {
      await sendConnectorMessage(config.extensionId, { ...connection, extensionId: undefined });
      if (!liveRef.current || startVersionRef.current !== version) return;
      setStatus('waiting');
      let failures = 0;
      const poll = async () => {
        if (!liveRef.current || connectionRef.current !== connection) return;
        try {
          if (Date.now() >= connection.expiresAt) throw new Error('지원서 연결 시간이 지났어요. 다시 연결해주세요.');
          const result = await sendConnectorMessage(config.extensionId, { type: 'FITPOLY_POLL', nonce: connection.nonce });
          if (!liveRef.current || connectionRef.current !== connection) return;
          if (result.status === 'captured') {
            const verified = validateApplicationCapture(result.capture, connection);
            connectionRef.current = null;
            setCapture(verified);
            setSelected(verified.questions.map((_, index) => index));
            setStatus('captured');
            return;
          }
          if (result.status === 'expired') throw new Error('지원서 연결이 종료되었어요. 다시 연결해주세요.');
          failures = 0;
        } catch (failure) {
          failures += 1;
          if (failures >= 2 || Date.now() >= connection.expiresAt) {
            stop();
            setStatus('idle');
            setError(failure.message);
            return;
          }
        }
        pollRef.current = setTimeout(poll, 1500);
      };
      pollRef.current = setTimeout(poll, 500);
    } catch (failure) {
      if (liveRef.current && startVersionRef.current === version) {
        stop();
        setStatus('idle');
        setError(failure.message);
      }
    }
  };

  const importSelected = async () => {
    if (!capture || !selected.length || disabled || importing) return;
    setImporting(true);
    setError('');
    try {
      await onImport({ ...capture, questions: capture.questions.filter((_, index) => selected.includes(index)) });
      if (liveRef.current) onClose();
    } catch (failure) { if (liveRef.current) setError(failure.response?.data?.error || failure.message || '문항을 가져오지 못했어요. 다시 시도해주세요.'); }
    finally { if (liveRef.current) setImporting(false); }
  };

  const pending = status === 'waiting' || status === 'connecting';
  return <section className="cl-panel cl-application-connector" ref={panelRef} aria-label="로그인한 지원서 연결">
    <div className="cl-connector-heading">
      <div><span className="cl-eyebrow">실제 지원서 연결</span><h3>로그인 후 열린 지원서에서 가져와요.</h3></div>
      <button className="cl-connector-close" aria-label="지원서 연결 닫기" disabled={importing || disabled} onClick={() => { stop(); onClose(); }}><X size={18} /></button>
    </div>
    <p className="cl-connector-intro">지원 사이트에서 직접 등록·로그인하고 자소서 입력 화면을 열어주세요. 연결 도구가 문항과 글자 수 제한을 읽어 가져옵니다.</p>
    <div className="cl-connector-target"><strong>{company || '지원 기업'}</strong><span>{position || '선택한 지원 직무'}</span>{target && <small>{new URL(target.url).hostname}</small>}</div>
    {error && <p className="cl-error" role="alert">{error}</p>}
    {targetError && <p className="cl-notice">{targetError}</p>}
    {!supported ? <p className="cl-notice">지원서 연결 도구는 PC의 Chrome·Edge에서 사용할 수 있어요. 모바일에서는 지원서 문항을 복사해 붙여넣어주세요.</p> : <>
      {!capture && <details className="cl-connector-install" open={!globalThis.chrome?.runtime?.sendMessage}>
        <summary>처음 연결한다면 · 도구 한 번 설치하기</summary>
        <ol>
          <li><a className="cl-button" href={CONNECTOR_DOWNLOAD_URL} download><Download size={14} /> 연결 도구 내려받기</a><span>내려받은 ZIP 파일의 압축을 풀어주세요.</span></li>
          <li>브라우저의 확장 프로그램 관리에서 <strong>개발자 모드</strong>를 켜고, <strong>압축 해제된 확장 프로그램을 로드</strong>로 압축을 푼 폴더를 선택해주세요.</li>
          <li>FitPoly 페이지를 새로고침한 뒤 다시 연결해주세요. 도구를 고정해두면 지원서에서 바로 열 수 있어요.</li>
        </ol>
        <p>확장 프로그램 관리 주소: Chrome <code>chrome://extensions</code> · Edge <code>edge://extensions</code></p>
      </details>}
      {!capture && <>
        <ol className="cl-connector-steps">
          <li><span>1</span><div><strong>FitPoly와 지원서 연결</strong><p>아래 연결 버튼을 눌러 가져올 기업과 직무를 지정해요.</p></div></li>
          <li><span>2</span><div><strong>실제 자소서 화면 열기</strong><p>지원 사이트에서 직접 등록·로그인하고 문항이 보이는 작성 단계로 이동해요.</p></div></li>
          <li><span>3</span><div><strong>연결 도구에서 문항 확인</strong><p>지원서 탭에서 FitPoly 도구를 열고 ‘문항 확인’ → ‘FitPoly로 가져오기’를 눌러요.</p></div></li>
        </ol>
        {pending && <p className="cl-connector-wait" role="status"><Loader2 className="animate-spin" size={15} /> {status === 'connecting' ? '연결 도구를 확인하고 있어요…' : '지원서에서 확인한 문항을 기다리고 있어요. 이 탭을 열어두세요.'}</p>}
        <div className="cl-missing-actions">
          <button className="cl-button cl-button-dark" disabled={!config || !target || disabled || pending} onClick={start}><Link2 size={15} /> 지원서 화면 연결하기</button>
          {target && <a className="cl-button" href={target.url} target="_blank" rel="noreferrer">실제 지원서 열기 <ExternalLink size={14} /></a>}
          {pending && <button className="cl-text-button" onClick={() => { stop(); setStatus('idle'); }}>연결 취소</button>}
        </div>
      </>}
      {capture && <div className="cl-capture-preview">
        <div className="cl-connector-preview-heading"><h4>가져온 문항을 확인해주세요</h4><span>{selected.length}/{capture.questions.length}개 선택</span></div>
        <p>선택한 기업·직무의 문항인지 확인하고 추가해주세요. 같은 문항의 작성한 답변과 연결 경험은 유지됩니다.</p>
        <div className="cl-capture-list">{capture.questions.map((question, index) => <label key={index} className={selected.includes(index) ? 'is-selected' : ''}>
          <input type="checkbox" checked={selected.includes(index)} disabled={importing || disabled} onChange={() => setSelected(previous => previous.includes(index) ? previous.filter(item => item !== index) : [...previous, index])} />
          <div><strong>{question.question}</strong><small>{question.minLength ? `${question.minLength}자 이상 · ` : ''}{question.maxLength ? `${question.maxLength}자 이내` : '글자 수 제한 확인 필요'} · 공백 {question.countSpaces ? '포함' : '제외'}</small><blockquote>{question.sourceQuote}</blockquote></div>
        </label>)}</div>
        {!!capture.warnings.length && <div className="cl-notice">{capture.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
        <div className="cl-missing-actions"><button className="cl-button cl-button-dark" disabled={!selected.length || importing || disabled} onClick={importSelected}>{importing ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} {selected.length}개 문항 추가하고 작성하기</button><button className="cl-text-button" disabled={importing || disabled} onClick={() => { setCapture(null); setSelected([]); setStatus('idle'); }}>다시 연결하기</button></div>
      </div>}
    </>}
    <p className="cl-connector-privacy">문항과 글자 수 제한만 가져와요. 비밀번호·쿠키·지원자 정보·이미 쓴 답변은 가져오지 않습니다.</p>
  </section>;
}
