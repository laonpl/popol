import { useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Check, FileSpreadsheet, Link2, PenLine, Printer, RefreshCw, Target, X } from 'lucide-react';
import api from '../../services/api';
import { buildPerformanceSnapshot, figmaEmbedUrl, performanceNumber } from '../../../../shared/rolePerformance.mjs';
import { caseArtifacts } from '../../utils/roleArtifacts';
import { metricComparison } from '../../utils/roleImpactReport';
import ArtifactPdfPreview from './ArtifactPdfPreview';
import RoleDataConnect from './RoleDataConnect';
import RolePlanningConnect from './RolePlanningConnect';
import SourceExperienceFlow from './SourceExperienceFlow';
import { sourceSummaryForPage, collectExperienceDocuments, experienceText } from '../../../../shared/sourceExperience.mjs';
import './RoleExperienceOnePager.css';

const fmt = value => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value);
export function onePagerMetrics(item, experience, role) {
  const data = experience.performanceData;
  const manual = (experience.roleSummary?.manualMetrics || []).filter(row => row.name && row.actual).map((row, i) => ({ ...row, id: `manual-${i}`, sourceName: '직접 입력' }));
  const imported = (data?.metrics || []).map(row => ({ ...row, id: `import-${row.id}`, sourceName: data.source?.name }));
  const recorded = item.metrics.filter(row => row.actual && !['unlocated', 'derived'].includes(row.basis)).map((row, i) => ({ ...row, id: `record-${i}` }));
  const all = [...imported, ...manual, ...recorded];
  const picked = experience.roleSummary?.primaryMetricIds;
  const priority = name => { const index = ['ROAS', 'CVR', 'CPA', '전환', '매출'].indexOf(name); return index < 0 ? 99 : index; };
  const ordered = role === 'marketer' ? [...all].sort((a, b) => priority(a.name) - priority(b.name)) : all;
  const chosen = picked?.map(id => all.find(row => row.id === id)).filter(Boolean);
  return { all, selected: (chosen?.length ? chosen : ordered).slice(0, 4) };
}
function MiniTrend({ metric }) {
  const points = metric.series || [];
  if (points.length < 2) return null;
  const min = Math.min(...points.map(point => point.value)), max = Math.max(...points.map(point => point.value));
  const path = points.map((point, i) => `${i ? 'L' : 'M'}${i / (points.length - 1) * 180} ${max === min ? 24 : 43 - (point.value - min) / (max - min) * 38}`).join(' ');
  return <svg className="one-spark" viewBox="0 0 180 48" role="img" aria-label={`${metric.name} ${points[0].date}부터 ${points.at(-1).date}까지 ${points.length}개 관찰값`}><path d={`${path} L180 48 L0 48Z`} className="one-spark-fill" /><path d={path} fill="none" stroke="currentColor" strokeWidth="2" />{points.map((point, i) => <circle key={i} cx={i / (points.length - 1) * 180} cy={max === min ? 24 : 43 - (point.value - min) / (max - min) * 38} r="2"><title>{point.date} · {fmt(point.value)}{metric.unit}</title></circle>)}</svg>;
}
function Kpi({ metric }) {
  const comparison = metricComparison(metric), current = performanceNumber(metric.actual), baseline = performanceNumber(metric.baseline), delta = comparison && current !== null && baseline !== null ? current - baseline : null;
  const unit = metric.unit || comparison?.unit || (metric.actual?.endsWith('%') ? '%' : '');
  const good = delta !== null && (metric.direction === 'down' ? delta < 0 : delta > 0);
  return <article className="one-kpi"><span>{metric.name}</span><strong>{metric.actual}</strong><div>{delta !== null ? <b data-positive={good}>{delta > 0 ? '+' : ''}{fmt(delta)}{unit === '%' ? '%p' : unit} <small>기준 대비</small></b> : <small>{metric.method || metric.period || '관찰한 결과'}</small>}{metric.target && <small>목표 {metric.target}</small>}</div><MiniTrend metric={metric} />{metric.baseline && <small className="one-kpi-baseline">기준 {metric.baseline} → 결과 {metric.actual}</small>}</article>;
}
function ChannelChart({ data }) {
  const field = data.channels.some(row => row.conversions !== null) ? 'conversions' : data.channels.some(row => row.clicks !== null) ? 'clicks' : 'impressions';
  const rows = data.channels.filter(row => row[field] !== null).sort((a, b) => b[field] - a[field]).slice(0, 4), max = Math.max(...rows.map(row => row[field]), 1);
  return <div className="one-channel-chart"><header><BarChart3 size={15} /><b>채널별 { { conversions: '전환', clicks: '클릭', impressions: '노출' }[field] }</b></header>{rows.map(row => <div key={row.name}><span>{row.name}</span><div><i style={{ width: `${row[field] / max * 100}%` }} /></div><b>{fmt(row[field])}</b></div>)}<small>{data.period} · 연결 데이터 집계</small></div>;
}
function OutcomeChart({ metrics }) {
  const metric = metrics.find(row => metricComparison(row) && performanceNumber(row.baseline) !== null);
  if (!metric) return null;
  const rows = [['기준', metric.baseline], ['결과', metric.actual], ['목표', metric.target]].filter(([, value]) => performanceNumber(value) !== null), max = Math.max(...rows.map(([, value]) => Math.abs(performanceNumber(value))), 1);
  return <div className="one-outcome-chart"><header><Target size={15} /><b>{metric.name}</b></header>{rows.map(([label, value]) => <div key={label} data-kind={label}><span>{label}</span><div><i style={{ width: `${Math.abs(performanceNumber(value)) / max * 100}%` }} /></div><strong>{value}</strong></div>)}<small>{metric.period || '기록한 기준과 관찰값'}</small></div>;
}
export default function RoleExperienceOnePager({ item, sr, role, onChange, readOnly, onExpand, project = sr.caseStudy || {} }) {
  const experience = sr.keyExperiences?.[item.sourceIndex] || {}, summary = sourceSummaryForPage(item, experience), data = experience.performanceData;
  const [connect, setConnect] = useState(false), [editing, setEditing] = useState(false), [draft, setDraft] = useState(summary), [busy, setBusy] = useState(false), [error, setError] = useState(''), [loadedEmbed, setLoadedEmbed] = useState(false);
  const [failedImage, setFailedImage] = useState('');
  const [planning, setPlanning] = useState(false);
  const { all, selected } = onePagerMetrics(item, experience, role);
  const files = caseArtifacts(sr, item), asset = files.find(file => file.id === summary.assetId) || files.find(file => file.image) || files.find(file => /pdf/i.test(file.ext || '')) || files[0];
  const figma = figmaEmbedUrl(summary.figmaUrl || files.find(file => figmaEmbedUrl(file.url))?.url || '');

  const w = item.workProducts;
  const problem = summary.problem || experienceText(role === 'pm' ? w.problems[0]?.problem : w.audiences[0]?.barrier);
  const action = summary.action || experienceText(role === 'pm' ? w.alternatives.find(row => /채택|선택/.test(row.disposition))?.reason : w.optimization[0]?.change || w.creatives[0]?.rationale);
  const outcome = summary.result || experienceText(role === 'pm' ? w.experiments[0]?.observation : w.optimization[0]?.observation);
  const learning = summary.learning || experienceText(item.nextExperiment);
  const ownership = experienceText(summary.myRole || item.records.find(row => row.ownership)?.ownership || (role === 'pm' ? w.collaboration[0]?.myAction : w.operations[0]?.myAction) || project.meta?.role);
  const patch = fields => { const { _newSourceAssets, ...changes } = fields; onChange({ ...sr, ...(_newSourceAssets?.length ? { deliverables: [...(sr.deliverables || []), ..._newSourceAssets] } : {}), keyExperiences: sr.keyExperiences.map((row, index) => index === item.sourceIndex ? { ...row, ...changes } : row) }); };
  const refresh = async () => { setBusy(true); setError(''); try { const { data: table } = await api.post('/role-data/sheets', { url: data.source.url }, { timeout: 20000 }); patch({ performanceData: buildPerformanceSnapshot(table, data.mapping, data.source) }); } catch (error) { setError(error.response?.data?.error || error.message); } finally { setBusy(false); } };
  const set = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  return <div className={`one-workspace one-${role}`}>
    {!readOnly && onChange && <div className="one-tools print:hidden"><span>핵심 경험 · 한 장 보기</span><button type="button" aria-label="Figma Notion 자료 연결" onClick={() => setPlanning(!planning)}><Link2 size={14} />자료로 경험 정리</button><button type="button" aria-label="성과 수치 연결" onClick={() => setConnect(!connect)}><FileSpreadsheet size={14} />수치 연결</button><button type="button" aria-label="한 장 편집" onClick={() => { setDraft({ ...summary, manualMetrics: summary.manualMetrics || [{ name: '', actual: '', baseline: '', target: '' }] }); setEditing(!editing); }}><PenLine size={14} />한 장 편집</button><button type="button" onClick={() => window.print()}><Printer size={14} />한 장 인쇄</button></div>}
    {planning && <RolePlanningConnect role={role} summary={{ ...summary, figmaUrl: summary.figmaUrl || files.find(file => figmaEmbedUrl(file.url))?.url || '' }} experience={experience} document={experience.planningConnection} figmaDocument={experience.figmaConnection} additionalDocuments={collectExperienceDocuments(sr, item).filter(document => !['figma', 'notion'].includes(document.type) && document !== experience.planningConnection)} onApply={patch} onClose={() => setPlanning(false)} />}
    {connect && <RoleDataConnect role={role} data={data} onApply={performanceData => patch({ performanceData })} onClose={() => setConnect(false)} />}
    {editing && <form className="one-editor print:hidden" aria-label="한 장 포트폴리오 편집" onSubmit={event => { event.preventDefault(); patch({ roleSummary: draft }); setEditing(false); }}><header><b>대표 경험의 핵심을 한 장에 담기</b><button type="button" aria-label="편집 닫기" onClick={() => setEditing(false)}><X size={17} /></button></header><div>{[['headline', '성과를 설명하는 제목'], ['myRole', '내가 직접 책임진 역할'], ['problem', '해결해야 했던 문제'], ['action', '내가 내린 선택과 실행'], ['validation', '검증 방법과 대상'], ['result', '확인한 결과'], ['learning', '다음 판단을 바꾼 배움']].map(([field, label]) => <label key={field}>{label}<textarea rows={2} maxLength={280} value={draft[field] || ''} onChange={event => set(field, event.target.value)} placeholder={{ headline: item.title, problem, action, result: outcome, learning, myRole: ownership }[field]} /></label>)}<label>Figma 디자인·프로토타입 URL<input value={draft.figmaUrl || ''} onChange={event => set('figmaUrl', event.target.value)} placeholder="https://www.figma.com/design/... 또는 /proto/..." /></label><label>대표 산출물<select value={draft.assetId || ''} onChange={event => set('assetId', event.target.value)}><option value="">자동 선택</option>{files.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}</select></label></div><fieldset><legend>대표 성과 선택 · 최대 4개</legend>{all.map(metric => <label key={metric.id}><input type="checkbox" checked={(draft.primaryMetricIds || selected.map(row => row.id)).includes(metric.id)} onChange={event => { const ids = draft.primaryMetricIds || selected.map(row => row.id); set('primaryMetricIds', event.target.checked ? [...ids.filter(id => id !== metric.id), metric.id].slice(-4) : ids.filter(id => id !== metric.id)); }} />{metric.name} · {metric.actual}</label>)}</fieldset><fieldset><legend>수치 직접 입력</legend>{(draft.manualMetrics || []).map((metric, i) => <div className="one-manual-row" key={i}>{[['name', '지표명'], ['baseline', '기준값'], ['actual', '결과값'], ['target', '목표값']].map(([field, label]) => <input key={field} aria-label={`직접 지표 ${i + 1} ${label}`} value={metric[field] || ''} placeholder={label + (field === 'name' ? '' : ' (예: 51%)')} onChange={event => set('manualMetrics', draft.manualMetrics.map((row, index) => index === i ? { ...row, [field]: event.target.value } : row))} />)}</div>)}{draft.manualMetrics?.length < 4 && <button type="button" onClick={() => set('manualMetrics', [...draft.manualMetrics, { name: '', actual: '', baseline: '', target: '' }])}>+ 지표 추가</button>}</fieldset>{draft.figmaUrl && !figmaEmbedUrl(draft.figmaUrl) && <p className="one-error">Figma의 디자인·프로토타입 공유 링크를 확인하세요.</p>}<footer><small>직접 쓴 수치는 작성자 입력으로 표시합니다.</small><button type="submit" disabled={!!draft.figmaUrl && !figmaEmbedUrl(draft.figmaUrl)}><Check size={14} />한 장 저장</button></footer></form>}
    {error && <p role="alert" className="one-error">{error}</p>}
    <section className="one-sheet" aria-label={`${role === 'pm' ? 'PM 제품' : '마케터 캠페인'} 경험 한 장 요약`}>
      <header className="one-sheet-heading"><div><span>{role === 'pm' ? 'PRODUCT / PLANNING CASE' : 'MARKETING / GROWTH CASE'}</span><h2>{summary.headline || item.title}</h2>{summary.subtitle && <p className="one-summary-subtitle">{summary.subtitle}</p>}<div className="one-meta">{[project.meta?.duration, project.meta?.team].filter(Boolean).join(" / ")}</div>{ownership && <p><b>MY ROLE</b>{ownership}</p>}</div><div className="one-sheet-tag"><Target size={21} /><span>{role === 'pm' ? '문제를 제품 변화로' : '실행을 고객 반응으로'}</span></div></header>
      {selected.length > 0 && <div className="one-kpis" style={{ '--one-kpi-count': selected.length }}>{selected.map(metric => <Kpi key={metric.id} metric={metric} />)}</div>}
      {(action || summary.process?.length || summary.decisions?.length || selected.some(row => metricComparison(row) && row.baseline)) && <div className="one-center one-content-center"><SourceExperienceFlow summary={{ ...summary, action }} item={item} role={role} /><aside className="one-visual-results">{role === 'marketer' && data?.channels?.length ? <ChannelChart data={data} /> : <OutcomeChart metrics={selected} />}{(summary.validation || outcome) && <div className="one-source-observation"><span>VALIDATION</span><b>{summary.validation ? "무엇으로 확인했는가" : "자료에서 확인한 반응"}</b><p>{summary.validation || outcome}</p></div>}</aside></div>}
      <div className="one-story">{[['01', 'PROBLEM', '고객 문제', problem], ['02', 'MY ACTION', '판단과 실행', action], ['03', 'IMPACT', '검증 결과', outcome]].filter(([, , , content]) => content).map(([num, en, label, content]) => <article key={num}><header><span>{num}</span><b>{en}<small>{label}</small></b></header><p title={content}>{content}</p></article>)}</div>
      {learning && <div className="one-learning"><span>LEARNING</span><p title={learning}>{learning}</p></div>}
      <footer className="one-data-footer"><span><FileSpreadsheet size={12} />{data ? [data.source.name, data.source.type === "documents" ? `관찰 지표 ${data.metrics.length}개` : `${data.rowCount}행`, data.period].filter(Boolean).join(" · ") : selected.map(row => row.sourceName || '경험 기록').filter((value, i, values) => values.indexOf(value) === i).join(' · ') || '경험 기록'}</span>{data && <small>갱신 {data.source.updatedAt.slice(0, 10)}</small>}{data?.source.type === 'sheets' && onChange && !readOnly && <button type="button" disabled={busy} onClick={refresh} className="print:hidden"><RefreshCw size={12} />{busy ? '갱신 중…' : '수치 갱신'}</button>}</footer>
    </section>
    {(figma || asset || experience.planningConnection || experience.figmaConnection) && <details className="one-source-original print:hidden"><summary>정리에 사용한 원본 자료 확인</summary><div>{figma && <><a href={summary.figmaUrl || experience.figmaConnection?.url || files.find(file => figmaEmbedUrl(file.url))?.url} target="_blank" rel="noreferrer">Figma 원본 열기 <ArrowUpRight size={12} /></a>{loadedEmbed ? <iframe title="연결한 Figma 원본 자료" src={figma} allowFullScreen /> : <button type="button" className="one-embed-start" onClick={() => setLoadedEmbed(true)}>원본 미리보기 열기</button>}</>}{experience.planningConnection && <a href={experience.planningConnection.url} target="_blank" rel="noreferrer">Notion 원본 열기 <ArrowUpRight size={12} /></a>}{asset && <><a href={asset.url} target="_blank" rel="noreferrer">{asset.name} 원본 열기 <ArrowUpRight size={12} /></a>{asset.image && failedImage !== asset.url ? <img src={asset.url} alt={asset.name} onError={() => setFailedImage(asset.url)} /> : /pdf/i.test(asset.ext || '') ? <ArtifactPdfPreview url={asset.url} name={asset.name} /> : null}</>}</div></details>}
    <div className="one-followup print:hidden">{onExpand && <button type="button" onClick={onExpand}>상세 판단·실행·원문 보기 <ArrowUpRight size={14} /></button>}{data && onChange && !readOnly && <button type="button" onClick={() => patch({ performanceData: null })}>이 경험에서 데이터 연결 해제</button>}</div>
  </div>;
}
