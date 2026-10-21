import { useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, FileSpreadsheet, Link2, PenLine, Plus, Printer, RefreshCw, X } from 'lucide-react';
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
  // 숫자만 기록된 값("31")에는 함께 추출된 단위("명")를 붙여 보여준다
  const withUnit = (value, unit) => (/^[\d.,+-]+$/.test(String(value || '').trim()) && /^(%p?|명|건|개|회|원|만원|배|점|초|분|시간|일|주|개월)$/.test(String(unit || '').trim()) ? `${value}${unit}` : value);
  const recorded = item.metrics.filter(row => row.actual && !['unlocated', 'derived'].includes(row.basis))
    .map((row, i) => ({ ...row, actual: withUnit(row.actual, row.unit), baseline: withUnit(row.baseline, row.unit), target: withUnit(row.target, row.unit), id: `record-${i}` }));
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
  return <div className="one-channel-chart"><header><b>채널별 { { conversions: '전환', clicks: '클릭', impressions: '노출' }[field] }</b></header>{rows.map(row => <div key={row.name}><span>{row.name}</span><div><i style={{ width: `${row[field] / max * 100}%` }} /></div><b>{fmt(row[field])}</b></div>)}<small>{data.period} · 연결 데이터 집계</small></div>;
}
function OutcomeChart({ metrics }) {
  const metric = metrics.find(row => metricComparison(row) && performanceNumber(row.baseline) !== null);
  if (!metric) return null;
  const rows = [['기준', metric.baseline], ['결과', metric.actual], ['목표', metric.target]].filter(([, value]) => performanceNumber(value) !== null), max = Math.max(...rows.map(([, value]) => Math.abs(performanceNumber(value))), 1);
  return <div className="one-outcome-chart"><header><b>{metric.name}</b></header>{rows.map(([label, value]) => <div key={label} data-kind={label}><span>{label}</span><div><i style={{ width: `${Math.abs(performanceNumber(value)) / max * 100}%` }} /></div><strong>{value}</strong></div>)}<small>{metric.period || '기록한 기준과 관찰값'}</small></div>;
}
// 마케터 캠페인 브리프 — 채용 담당자가 먼저 찾는 누구에게(타깃·고른 근거) · 어디서(채널·선택 이유) · 무엇을(실제 문구).
// 한 장 편집에 직접 쓴 내용(roleSummary)이 먼저고, 없으면 추출된 캠페인 기록을 쓴다.
function campaignBrief(item, experience, summary) {
  const jd = experience.jobData || {}, w = item.workProducts;
  const audience = w.audiences[0] || {};
  const creative = w.creatives.find(row => experienceText(row.hook)) || {};
  const positioning = w.positioning[0] || {};
  const rows = w.channels.map(row => ({ name: experienceText(row.channel), role: experienceText(row.purpose), why: experienceText(row.rationale) })).filter(row => row.name);
  const listed = (Array.isArray(jd.channels) ? jd.channels : []).map(name => experienceText(name))
    .filter(name => name && !rows.some(row => row.name.includes(name) || name.includes(row.name))).map(name => ({ name, role: '', why: '' }));
  const hook = experienceText(summary.message) || experienceText(creative.hook);
  return {
    target: experienceText(summary.audience) || experienceText(jd.target) || experienceText(audience.segment),
    targetWhy: experienceText(jd.audienceInsight) || [audience.signal, audience.need, audience.barrier].map(experienceText).filter(Boolean).join(' '),
    channels: [...rows, ...listed].slice(0, 3),
    channelNote: experienceText(summary.channel),
    message: hook || experienceText(positioning.promise) || experienceText(jd.creative),
    messageIsCopy: !!hook,
    messageWhy: experienceText(creative.rationale) || experienceText(positioning.proof),
  };
}

export default function RoleExperienceOnePager({ item, sr, role, onChange, readOnly, project = sr.caseStudy || {} }) {
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
  // 추출된 '내 역할'이 "myself"처럼 내용 없는 값이면 건너뛴다
  const ownership = experienceText(summary.myRole || item.records.map(row => experienceText(row.ownership)).find(text => /[가-힣]/.test(text) && text.length >= 4) || (role === 'pm' ? w.collaboration[0]?.myAction : w.operations[0]?.myAction) || project.meta?.role);
  const patch = fields => { const { _newSourceAssets, ...changes } = fields; onChange({ ...sr, ...(_newSourceAssets?.length ? { deliverables: [...(sr.deliverables || []), ..._newSourceAssets] } : {}), keyExperiences: sr.keyExperiences.map((row, index) => index === item.sourceIndex ? { ...row, ...changes } : row) }); };
  const refresh = async () => { setBusy(true); setError(''); try { const { data: table } = await api.post('/role-data/sheets', { url: data.source.url }, { timeout: 20000 }); patch({ performanceData: buildPerformanceSnapshot(table, data.mapping, data.source) }); } catch (error) { setError(error.response?.data?.error || error.message); } finally { setBusy(false); } };
  const set = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  const editable = !readOnly && !!onChange;
  const editorRef = useRef(null);
  const openEditor = () => {
    setPlanning(false);
    setConnect(false);
    setDraft({ ...summary, manualMetrics: summary.manualMetrics || [{ name: '', actual: '', baseline: '', target: '' }] });
    setEditing(true);
    window.setTimeout(() => editorRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0);
  };
  const centerShown = !!(action || summary.process?.length || summary.decisions?.length || selected.some(row => metricComparison(row) && row.baseline));
  // 마케터: 고객 문제·판단·결과 3칸 대신 캠페인 브리프. 과제는 제목 아래 한 줄, 결과는 성과 수치·검증 칸에 남는다.
  const brief = role === 'marketer' ? campaignBrief(item, experience, summary) : null;
  const challenge = brief ? experienceText(experience.roleSummary?.problem) || experienceText(experience.jobData?.businessProblem) || problem : '';
  const fill = label => editable && <button type="button" className="one-brief-fill print:hidden" onClick={openEditor}><Plus size={13} />{label}</button>;
  const briefCells = brief ? [
    (brief.target || editable) && { key: 'target', title: '누구에게', sub: '타깃과 고른 이유',
      body: brief.target ? <><h4>{brief.target}</h4>{brief.targetWhy && <p>{brief.targetWhy}</p>}</> : fill('타깃과 고른 이유 적기') },
    (brief.channels.length || brief.channelNote || editable) && { key: 'channel', title: '어디서 · 왜', sub: '채널과 선택 이유',
      body: <>{brief.channels.length > 0 && <ul>{brief.channels.map(c => <li key={c.name}><b>{c.name}</b>{c.role && <small>{c.role}</small>}{c.why && <p>{c.why}</p>}</li>)}</ul>}
        {brief.channelNote && <p>{brief.channelNote}</p>}
        {!brief.channelNote && !brief.channels.some(c => c.why) && fill(brief.channels.length ? '이 채널을 고른 이유 적기' : '채널과 선택 이유 적기')}</> },
    (brief.message || editable) && { key: 'message', title: '무엇을 말했나', sub: brief.messageIsCopy ? '실제 문구' : '핵심 메시지',
      body: brief.message ? <><h4 className={brief.messageIsCopy ? 'one-brief-copy' : ''}>{brief.messageIsCopy ? `“${brief.message}”` : brief.message}</h4>{brief.messageWhy && <p>{brief.messageWhy}</p>}</> : fill('실제로 쓴 문구 적기') },
    !centerShown && outcome && { key: 'result', title: '결과', sub: '확인한 반응', body: <p>{outcome}</p> },
  ].filter(Boolean) : [];
  return <div className={`one-workspace one-${role}`}>
    {editable && <div className="one-tools print:hidden">
      <span>선택한 경험 편집</span>
      <button type="button" aria-label="Figma Notion 자료 연결" aria-expanded={planning} onClick={() => { setPlanning(!planning); setConnect(false); setEditing(false); }}><Link2 size={14} />자료 연결</button>
      <button type="button" aria-label="성과 수치 연결" aria-expanded={connect} onClick={() => { setConnect(!connect); setPlanning(false); setEditing(false); }}><FileSpreadsheet size={14} />수치 연결</button>
      <button type="button" className="one-edit-action" aria-expanded={editing} onClick={() => editing ? setEditing(false) : openEditor()}><PenLine size={14} />경험 편집</button>
      <button type="button" className="one-print-action" onClick={() => window.print()}><Printer size={14} />인쇄</button>
    </div>}
    {planning && <RolePlanningConnect role={role} summary={{ ...summary, figmaUrl: summary.figmaUrl || files.find(file => figmaEmbedUrl(file.url))?.url || '' }} experience={experience} document={experience.planningConnection} figmaDocument={experience.figmaConnection} additionalDocuments={collectExperienceDocuments(sr, item).filter(document => !['figma', 'notion'].includes(document.type) && document !== experience.planningConnection)} onApply={patch} onClose={() => setPlanning(false)} />}
    {connect && <RoleDataConnect role={role} data={data} onApply={performanceData => patch({ performanceData })} onClose={() => setConnect(false)} />}
    {editing && <form ref={editorRef} className="one-editor print:hidden" aria-label="한 장 포트폴리오 편집" onSubmit={event => { event.preventDefault(); patch({ roleSummary: draft }); setEditing(false); }}><header><b>대표 경험의 핵심을 한 장에 담기</b><button type="button" aria-label="편집 닫기" onClick={() => setEditing(false)}><X size={17} /></button></header><div>{[['headline', '성과를 설명하는 제목'], ['myRole', '내가 직접 책임진 역할'], ['problem', role === 'marketer' ? '해결해야 했던 과제' : '해결해야 했던 문제'],
      ...(brief ? [['audience', '누구에게 · 그 고객을 고른 이유'], ['channel', '어디서 · 그 채널을 고른 이유'], ['message', '무엇을 · 실제로 쓴 핵심 문구']] : []),
      ['action', '내가 내린 선택과 실행'], ['validation', '검증 방법과 대상'], ['result', '확인한 결과'], ['learning', '다음 판단을 바꾼 배움']].map(([field, label]) => <label key={field}>{label}<textarea rows={2} maxLength={280} value={draft[field] || ''} onChange={event => set(field, event.target.value)} placeholder={{ headline: item.title, problem: challenge || problem, action, result: outcome, learning, myRole: ownership,
        audience: brief?.target ? `${brief.target}${brief.targetWhy ? ` — ${brief.targetWhy}` : ''}` : '예: 시험기간에 밤 간식을 찾는 기숙사생 — 인터뷰 9명 중 7명이 밤 9시 이후 갈 곳이 편의점뿐이라고 답함',
        channel: brief?.channels.length ? brief.channels.map(c => `${c.name}${c.why ? ` — ${c.why}` : ''}`).join(' / ') : '예: 에브리타임 — 기숙사생이 학교 소식을 가장 먼저 보는 곳이라 1순위로 정함',
        message: brief?.message || '예: “편의점 말고, 갓 구운 빵 — 밤 10시까지”' }[field]} /></label>)}<label>Figma 디자인·프로토타입 URL<input value={draft.figmaUrl || ''} onChange={event => set('figmaUrl', event.target.value)} placeholder="https://www.figma.com/design/... 또는 /proto/..." /></label><label>대표 산출물<select value={draft.assetId || ''} onChange={event => set('assetId', event.target.value)}><option value="">자동 선택</option>{files.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}</select></label></div><fieldset><legend>대표 성과 선택 · 최대 4개</legend>{all.map(metric => <label key={metric.id}><input type="checkbox" checked={(draft.primaryMetricIds || selected.map(row => row.id)).includes(metric.id)} onChange={event => { const ids = draft.primaryMetricIds || selected.map(row => row.id); set('primaryMetricIds', event.target.checked ? [...ids.filter(id => id !== metric.id), metric.id].slice(-4) : ids.filter(id => id !== metric.id)); }} />{metric.name} · {metric.actual}</label>)}</fieldset><fieldset><legend>수치 직접 입력</legend>{(draft.manualMetrics || []).map((metric, i) => <div className="one-manual-row" key={i}>{[['name', '지표명'], ['baseline', '기준값'], ['actual', '결과값'], ['target', '목표값']].map(([field, label]) => <input key={field} aria-label={`직접 지표 ${i + 1} ${label}`} value={metric[field] || ''} placeholder={label + (field === 'name' ? '' : ' (예: 51%)')} onChange={event => set('manualMetrics', draft.manualMetrics.map((row, index) => index === i ? { ...row, [field]: event.target.value } : row))} />)}</div>)}{draft.manualMetrics?.length < 4 && <button type="button" onClick={() => set('manualMetrics', [...draft.manualMetrics, { name: '', actual: '', baseline: '', target: '' }])}>+ 지표 추가</button>}</fieldset>{draft.figmaUrl && !figmaEmbedUrl(draft.figmaUrl) && <p className="one-error">Figma의 디자인·프로토타입 공유 링크를 확인하세요.</p>}<footer><small>직접 쓴 수치는 작성자 입력으로 표시합니다.</small><button type="submit" disabled={!!draft.figmaUrl && !figmaEmbedUrl(draft.figmaUrl)}><Check size={14} />변경 적용</button></footer></form>}
    {error && <p role="alert" className="one-error">{error}</p>}
    <section className="one-sheet" aria-label={`${role === 'pm' ? 'PM 제품' : '마케터 캠페인'} 경험 한 장 요약`}>
      <header className="one-sheet-heading"><div><span>{role === 'pm' ? 'PRODUCT / PLANNING CASE' : 'MARKETING / GROWTH CASE'}</span><h2>{summary.headline || item.title}</h2>{summary.subtitle && <p className="one-summary-subtitle">{summary.subtitle}</p>}<div className="one-meta">{[project.meta?.duration, project.meta?.team].filter(Boolean).join(" / ")}</div>{challenge && <p><b>CHALLENGE</b>{challenge}</p>}{ownership && <p><b>MY ROLE</b>{ownership}</p>}</div></header>
      {selected.length > 0 && <div className="one-kpis" style={{ '--one-kpi-count': selected.length }}>{selected.map(metric => <Kpi key={metric.id} metric={metric} />)}</div>}
      {briefCells.length > 0 && <div className="one-brief" aria-label="캠페인 브리프" style={{ '--one-brief-count': briefCells.length }}>{briefCells.map((cell, i) => <article key={cell.key}><header><span>{String(i + 1).padStart(2, '0')}</span><b>{cell.title}<small>{cell.sub}</small></b></header>{cell.body}</article>)}</div>}
      {centerShown && <div className="one-center one-content-center"><SourceExperienceFlow summary={{ ...summary, action, ...(brief ? { audience: '' } : {}) }} item={item} role={role} /><aside className="one-visual-results">{role === 'marketer' && data?.channels?.length ? <ChannelChart data={data} /> : <OutcomeChart metrics={selected} />}{(summary.validation || outcome) && <div className="one-source-observation"><span>VALIDATION</span><b>{summary.validation ? "무엇으로 확인했는가" : "자료에서 확인한 반응"}</b><p>{summary.validation || outcome}</p></div>}</aside></div>}
      {!briefCells.length && <div className="one-story">{[['01', 'PROBLEM', '고객 문제', problem], ['02', 'MY ACTION', '판단과 실행', action], ['03', 'IMPACT', '검증 결과', outcome]].filter(([, , , content]) => content).map(([num, en, label, content]) => <article key={num}><header><span>{num}</span><b>{en}<small>{label}</small></b></header><p title={content}>{content}</p></article>)}</div>}
      {learning && <div className="one-learning"><span>LEARNING</span><p title={learning}>{learning}</p></div>}
      <footer className="one-data-footer"><span><FileSpreadsheet size={12} />{data ? [data.source.name, data.source.type === "documents" ? `관찰 지표 ${data.metrics.length}개` : `${data.rowCount}행`, data.period].filter(Boolean).join(" · ") : selected.map(row => row.sourceName || '경험 기록').filter((value, i, values) => values.indexOf(value) === i).join(' · ') || '경험 기록'}</span>{data && <small>갱신 {data.source.updatedAt.slice(0, 10)}</small>}{data?.source.type === 'sheets' && onChange && !readOnly && <button type="button" disabled={busy} onClick={refresh} className="print:hidden"><RefreshCw size={12} />{busy ? '갱신 중…' : '수치 갱신'}</button>}</footer>
    </section>
    {(figma || asset || experience.planningConnection || experience.figmaConnection) && <details className="one-source-original print:hidden"><summary>정리에 사용한 원본 자료 확인</summary><div>{figma && <><a href={summary.figmaUrl || experience.figmaConnection?.url || files.find(file => figmaEmbedUrl(file.url))?.url} target="_blank" rel="noreferrer">Figma 원본 열기 <ArrowUpRight size={12} /></a>{loadedEmbed ? <iframe title="연결한 Figma 원본 자료" src={figma} allowFullScreen /> : <button type="button" className="one-embed-start" onClick={() => setLoadedEmbed(true)}>원본 미리보기 열기</button>}</>}{experience.planningConnection && <a href={experience.planningConnection.url} target="_blank" rel="noreferrer">Notion 원본 열기 <ArrowUpRight size={12} /></a>}{asset && <><a href={asset.url} target="_blank" rel="noreferrer">{asset.name} 원본 열기 <ArrowUpRight size={12} /></a>{asset.image && failedImage !== asset.url ? <img src={asset.url} alt={asset.name} onError={() => setFailedImage(asset.url)} /> : /pdf/i.test(asset.ext || '') ? <ArtifactPdfPreview url={asset.url} name={asset.name} /> : null}</>}</div></details>}
    {data && editable && <div className="one-followup print:hidden"><button type="button" onClick={() => patch({ performanceData: null })}>이 경험에서 데이터 연결 해제</button></div>}
  </div>;
}
