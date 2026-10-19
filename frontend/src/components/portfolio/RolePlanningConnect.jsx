import { useRef, useState } from 'react';
import { ArrowUpRight, FileText, Link2, X } from 'lucide-react';
import api from '../../services/api';
import { figmaEmbedUrl } from '../../../../shared/rolePerformance.mjs';
import { planningDocumentText } from '../../../../shared/sourceExperience.mjs';
import { experienceText } from '../../../../shared/sourceExperience.mjs';
import { importFileUpload } from '../../services/importAI';
import { uploadDocumentFile } from '../../services/uploadImage';

export default function RolePlanningConnect({ role, summary, document, figmaDocument, experience, additionalDocuments = [], onApply, onClose }) {
  const [figma, setFigma] = useState(summary.figmaUrl || figmaDocument?.url || ''), [url, setUrl] = useState(document?.url || '');
  const [notionToken, setNotionToken] = useState(''), [figmaToken, setFigmaToken] = useState('');
  const [notion, setNotion] = useState(document), [figmaSource, setFigmaSource] = useState(figmaDocument);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [uploaded, setUploaded] = useState([]); const fileInput = useRef(null);
  const readFile = async file => {
    if (!file) return; setBusy(true); setError(''); setStatus('파일 안의 텍스트·표·이미지 자료를 읽는 중…');
    try { const form = new FormData(); form.append('file', file); form.append('readGraphics', 'true');
      const [result, asset] = await Promise.all([importFileUpload(form), uploadDocumentFile(file, { optional: true }).catch(() => null)]);
      const content = result.imported?.content || result.imported?.rawText || '';
      if (!content.trim()) throw new Error('파일 내용을 읽지 못했습니다. 다른 원본 파일로 가져오세요.');
      const id = `source-file-${crypto.randomUUID()}`;
      setUploaded(current => [...current, { type: 'file', title: file.name, url: asset?.url || '', assetId: id, sections: (content.slice(0, 50000).match(/[\s\S]{1,14000}/g) || []).map((text, index) => ({ id: `${id}-${index}`, type: 'text', text })), tables: [], updatedAt: new Date().toISOString(), ...(asset?.url ? { asset: { id, name: file.name, url: asset.url, kind: 'file', ext: file.name.split('.').pop().toLowerCase() } } : {}) }]);
      setStatus('파일 내부 내용을 읽었습니다. 이 내용으로 경험을 작성합니다.');
    } catch (error) { setError(error.response?.data?.error || error.message); setStatus(''); } finally { setBusy(false); }
  };
  const readNotion = async () => { const { data } = await api.post('/role-data/notion', { url, ...(notionToken ? { token: notionToken } : {}) }, { timeout: 25000 }); setNotion(data); return data; };
  const readFigma = async () => { const { data } = await api.post('/role-data/figma', { url: figma, token: figmaToken }, { timeout: 40000 }); setFigmaSource(data); return data; };
  const read = async which => { setBusy(true); setError(''); setStatus('자료 내부 내용을 읽는 중…'); try { await (which === 'figma' ? readFigma() : readNotion()); setStatus('내부 내용을 읽었습니다. 이제 경험으로 정리할 수 있습니다.'); } catch (error) { setError(error.response?.data?.error || error.message); setStatus(''); } finally { setBusy(false); setNotionToken(''); setFigmaToken(''); } };
  const analyze = async () => {
    setBusy(true); setError('');
    try {
      let f = figma && figmaSource?.url === figma ? figmaSource : null, n = url ? notion : null;
      if (figma && !f && (figmaToken || !(uploaded.length || additionalDocuments.length))) { setStatus('Figma 슬라이드·텍스트를 읽는 중…'); f = await readFigma(); }
      if (url && (!n || n.url !== url)) { setStatus('Notion 기획서 본문을 읽는 중…'); n = await readNotion(); }
      const documents = [f, n, ...additionalDocuments, ...uploaded].filter(source => source && (planningDocumentText(source).trim() || source.renders?.length));
      if (!documents.length) throw new Error('내부 내용을 읽을 자료가 필요합니다. Figma 파일 읽기 권한을 연결하거나 보관함에서 PDF·문서를 가져오세요.');
      setStatus('문제·판단·실행·검증을 한 페이지 경험으로 정리하는 중…');
      const { data } = await api.post('/role-data/experience-summary', { documents, role, experience: { title: experience?.title || '', context: experience?.context || '' } }, { timeout: 180000 });
      const next = { roleSummary: { ...summary, ...data.summary, figmaUrl: figma, processing: data.processing }, title: data.summary.headline || experience?.title,
        context: data.summary.problem, action: data.summary.action, result: data.summary.result, learning: data.summary.learning };
      if (experience?.jobData) next.jobData = { ...experience.jobData, ...Object.fromEntries(['pmEvidence', 'marketerEvidence'].filter(key => experience.jobData[key]).map(key => [key, experience.jobData[key].filter(row => experienceText(row.claim))])) };
      const docs = data.documents || documents;
      if (f) next.figmaConnection = docs.find(source => source.type === 'figma') || f;
      if (n) next.planningConnection = docs.find(source => source.url === n.url) || n;
      const files = docs.filter(source => source.type === 'file');
      if (files.length) next.sourceDocuments = files.map(({ asset, ...source }) => source);
      if (uploaded.some(source => source.asset)) next._newSourceAssets = uploaded.map(source => source.asset).filter(Boolean);
      if (uploaded.some(source => source.asset)) next.artifactBindings = [...(experience?.artifactBindings || []), ...uploaded.filter(source => source.asset).map(source => ({ assetId: source.asset.id, caption: '경험 정리에 사용한 원본 자료' }))];
      if (data.metrics.length) next.performanceData = { version: 2, source: { type: 'documents', name: documents.map(source => source.title).join(' · '), updatedAt: data.processing.updatedAt }, period: '', rowCount: data.metrics.length, metrics: data.metrics, channels: [] };
      onApply(next); onClose();
    } catch (error) { setError(error.response?.data?.error || error.message); setStatus(''); }
    finally { setBusy(false); setNotionToken(''); setFigmaToken(''); }
  };
  const preview = source => source && <details className="one-notion-preview"><summary>{source.type === 'figma' ? 'Figma' : 'Notion'}에서 읽은 실제 내용 · {source.sections.length}개</summary><div>{source.sections.map(section => section.type === 'heading' ? <h4 key={section.id}>{section.text}</h4> : <p key={section.id}>{section.text}</p>)}</div></details>;
  return <section className="one-connect one-planning-connect print:hidden" aria-label="Figma Notion 기획 자료 연결"><header><div><b><FileText size={17} />자료 내용으로 경험 정리</b><p>슬라이드·기획서 안의 고객 문제, 내 선택과 실행, 실제 검증 결과를 읽고 경험 본문을 작성합니다.</p></div><button type="button" onClick={onClose} aria-label="자료 연결 닫기"><X size={18} /></button></header>
    <div className="one-connect-sources"><div><b><img src="/brand-icons/figma.svg" alt="" />Figma · Slides 내부 자료</b><p>텍스트 레이어와 이미지로 들어간 표·검증 화면을 함께 읽습니다.</p><input aria-label="연결할 Figma URL" value={figma} onChange={event => setFigma(event.target.value)} placeholder="Figma 디자인 또는 Slides URL" /><label className="one-source-token">파일 내용 읽기 권한<input aria-label="Figma 파일 읽기 토큰" type="password" autoComplete="off" value={figmaToken} onChange={event => setFigmaToken(event.target.value)} placeholder="Figma 파일 읽기 토큰" /></label><small>토큰은 이번 읽기에만 사용합니다. 토큰 대신 Slides를 PDF로 내려받아 좌측 보관함에 가져올 수 있습니다.</small><button type="button" disabled={busy || !figma || !figmaEmbedUrl(figma)} onClick={() => read('figma')}>Figma 내용 읽기</button><a className="one-source-help" href="https://developers.figma.com/docs/rest-api/authentication/" target="_blank" rel="noreferrer">Figma 읽기 권한 안내 <ArrowUpRight size={11} /></a>{figma && !figmaEmbedUrl(figma) && <p className="one-error">Figma 공유 URL을 확인하세요.</p>}</div>
    <div><b><img src="/brand-icons/notion.svg" alt="" />Notion 기획서 · 회고</b><p>단순히 제목별로 복사하지 않고 자료의 맥락을 정리합니다.</p><input aria-label="연결할 Notion URL" value={url} onChange={event => setUrl(event.target.value)} placeholder="Notion 페이지 URL" /><details className="one-notion-access"><summary>비공개 자료 읽기 권한</summary><input aria-label="Notion 연결 토큰" type="password" autoComplete="off" value={notionToken} onChange={event => setNotionToken(event.target.value)} placeholder="Notion 연결 토큰" /><small>토큰은 이번 읽기에만 사용하고 저장하지 않습니다.</small></details><button type="button" disabled={busy || !url} onClick={() => read('notion')}>Notion 내용 읽기</button></div></div>
    <div className="one-source-file-picker"><button type="button" disabled={busy} onClick={() => fileInput.current.click()}><FileText size={14} />Slides PDF·이미지에서 내용 읽기</button><input hidden type="file" ref={fileInput} accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={event => { readFile(event.target.files[0]); event.target.value = ''; }} /><small>원본을 내보낸 파일은 Figma 토큰 없이 경험으로 정리할 수 있습니다.</small></div>
    {(additionalDocuments.length > 0 || uploaded.length > 0) && <p className="one-source-files">파일 본문 {additionalDocuments.length + uploaded.length}개도 함께 정리합니다.</p>}
    {status && <p className="one-source-status" role="status">{status}</p>}{error && <p role="alert" className="one-error">{error}</p>}
    {preview(figmaSource)}{preview(notion)}
    <footer><small>자료에 없는 성과를 채우지 않습니다. 정리된 내용은 한 장 편집에서 수정할 수 있습니다.</small><button type="button" disabled={busy || (!figma && !url && !additionalDocuments.length && !uploaded.length)} onClick={analyze}><Link2 size={14} />{busy ? '경험을 정리하는 중…' : '자료 내용으로 경험 정리'}</button></footer>
  </section>;
}
