import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Search, Loader2, Check, ArrowRight, RefreshCw, HardDrive, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import useExperienceStore, { JOB_CATEGORIES } from '../stores/experienceStore';
import { scanLocalDirectory, scanLocalFileList, organizeLocalFiles, mergeLocalCandidates,
  normalizeLocalTitle, LOCAL_SELECTION_LIMIT, findCoreLocalExperiences, splitLocalCandidate, reconcileLocalCandidates } from '../services/localExperienceFiles';
import { CORE_EXPERIENCE_LIMIT, sortLocalExperiences } from '../../../local-connector/experienceSelection.mjs';
import { isExperienceTitle } from '../../../local-connector/experienceEvidence.mjs';
import { analyzeLocalExperiences } from '../services/localExperienceAnalysis';
import { discoverLocalExperiences } from '../services/localExperienceConnector';
import { CAREER_STAGES, normalizeCareerStage } from '../constants/careerStages';
import { materialPlainText } from '../../../shared/materialPlainText.mjs';
import './localExperienceImport.css';

const formatSize = size => size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;
const toggle = (set, id) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); return next; };
const FIELD_LABELS = { period: '기간', role: '내 역할', context: 'S · 상황 (Situation)', task: 'T · 과제·목표 (Task)', action: 'A · 내가 한 행동 (Action)', result: 'R · 결과 (Result)', learning: '배운 점 (선택)' };
const JOB_OPTIONS = JOB_CATEGORIES.flatMap(group => group.items);
const ROOT_STATES = { complete: '탐색 완료', covered: '다른 위치에서 확인', limited: '일부 확인', inaccessible: '접근 권한 없음', missing: '폴더 없음', pending: '대기', scanning: '탐색 중' };
const editableText = value => {
  const text = String(value ?? '');
  return /<\/?(?:li|ul|ol|p|div|h[1-6]|strong|em|span|b|i|a|code|br)\b[^>]*>|&lt;\/?\w|\*\*[^\n]+\*\*|^\s*#{1,6}\s/m.test(text) ? materialPlainText(text) : text;
};

export default function LocalExperienceImport({ onImported, onOpenResult, onBusyChange }) {
  const user = useAuthStore(state => state.user);
  const profile = useAuthStore(state => state.profile);
  const { experiences, fetchExperiences, createExperience, analyzeExperience } = useExperienceStore();
  const inputRef = useRef(null);
  const operation = useRef(null);
  const [step, setStep] = useState('choose');
  const [folder, setFolder] = useState('');
  const [inventory, setInventory] = useState(null);
  const [automatic, setAutomatic] = useState(false);
  const [automaticOffset, setAutomaticOffset] = useState(0);
  const [connectorMissing, setConnectorMissing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState('');
  const [items, setItems] = useState([]);
  const [visibleCount, setVisibleCount] = useState(CORE_EXPERIENCE_LIMIT);
  const [rejected, setRejected] = useState([]);
  const [supporting, setSupporting] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [records, setRecords] = useState({});
  const [jobCategory, setJobCategory] = useState(() => {
    const role = profile?.jobCategory || profile?.targetJobCategory || 'common';
    return JOB_OPTIONS.some(option => option.value === role) ? role : 'common';
  });
  const [careerStage, setCareerStage] = useState(() => normalizeCareerStage(profile?.careerStage));
  const [momentsCount, setMomentsCount] = useState(3);
  const stopRequested = useRef(false);
  const [stopping, setStopping] = useState(false);
  const [failures, setFailures] = useState([]);
  const [error, setError] = useState('');
  const busy = ['scanning', 'reading', 'analyzing'].includes(step);
  const savedIds = useMemo(() => new Set(Object.keys(records).filter(id => records[id].status === 'complete')), [records]);
  const jobLabel = JOB_OPTIONS.find(option => option.value === jobCategory)?.label || '공통';
  const existingTitles = useMemo(() => new Set(experiences.map(item => normalizeLocalTitle(item.title))), [experiences]);
  const visibleFiles = useMemo(() => (inventory?.files || []).filter(file => file.path.toLowerCase().includes(query.trim().toLowerCase())), [inventory, query]);
  const visibleItems = automatic ? items.slice(0, visibleCount) : items;

  useEffect(() => {
    if (user?.uid) fetchExperiences(user.uid);
    return () => { operation.current?.abort(); stopRequested.current = true; };
  }, [user?.uid]);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);

  const automaticSearch = async (more = false, waitForConnection = false, browserHandle = null) => {
    const controller = new AbortController();
    operation.current = controller;
    setStep('scanning'); setError(''); setConnectorMissing(false);
    try {
      const allowedFolder = browserHandle || inventory?.browserDirectoryHandle;
      const result = more ? inventory : allowedFolder
        ? { ...await scanLocalDirectory(allowedFolder, { signal: controller.signal, onProgress: count => setProgress(`${count}개 항목 확인 중`) }),
          roots: [`허용한 폴더 · ${allowedFolder.name}`], browserDirectoryHandle: allowedFolder }
        : await discoverLocalExperiences({ signal: controller.signal, onProgress: setProgress, waitForConnection });
      controller.signal.throwIfAborted();
      setInventory(result); setFolder(allowedFolder ? `허용한 폴더 · ${allowedFolder.name}` : '내 컴퓨터 자동 탐색'); setAutomatic(true);
      const start = more ? automaticOffset : 0;
      if (!more) { setItems([]); setRecords({}); setFailures([]); setRejected([]); setSupporting([]); setVisibleCount(CORE_EXPERIENCE_LIMIT); }
      setStep('reading');
      const parsed = await findCoreLocalExperiences(result.files, { offset: start, previous: more ? items : [], supporting: more ? supporting : [],
        signal: controller.signal,
        onProgress: ({ checked, totalDocuments, path }) => setProgress(`핵심경험 선별 ${checked}/${totalDocuments} · ${path}`),
      });
      controller.signal.throwIfAborted();
      const reconciled = more ? reconcileLocalCandidates(items, parsed.items, { selectedItems, records, supporting: parsed.supporting }) : null;
      const ordered = reconciled?.items || sortLocalExperiences(parsed.items);
      setItems(ordered);
      if (more) {
        setSelectedItems(reconciled.selectedItems); setRecords(reconciled.records);
        const lastPinned = ordered.reduce((last, item, index) => reconciled.preservedIds.has(item.id) ? index + 1 : last, 0);
        setVisibleCount(previous => Math.max(previous, lastPinned));
      }
      if (!more) setSelectedItems(new Set(ordered.slice(0, CORE_EXPERIENCE_LIMIT).filter(item => !existingTitles.has(normalizeLocalTitle(item.title))).map(item => item.id)));
      setFailures(old => [...(more ? old : []), ...parsed.failures]);
      const usedPaths = new Set(ordered.flatMap(item => item.sourcePaths));
      setRejected(old => [...(more ? old : []), ...parsed.rejected].filter(entry => !usedPaths.has(entry.path))
        .filter((entry, index, all) => all.findIndex(row => row.path === entry.path && row.title === entry.title && row.reason === entry.reason) === index));
      setSupporting(parsed.supporting);
      setAutomaticOffset(parsed.offset); setStep('review');
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause.message || '내 컴퓨터에서 자료를 찾지 못했어요.');
        setConnectorMissing(cause.code === 'LOCAL_CONNECTOR_UNAVAILABLE');
      }
      setStep(more ? 'review' : 'choose');
    }
  };

  const scan = async (source, label, fallback = false) => {
    const controller = new AbortController();
    operation.current = controller;
    setStep('scanning'); setError(''); setProgress('파일 목록을 확인하고 있어요.');
    try {
      const options = { signal: controller.signal, onProgress: count => setProgress(`${count}개 항목 확인 중`) };
      const result = await (fallback ? scanLocalFileList(source, options) : scanLocalDirectory(source, options));
      if (controller.signal.aborted) { setStep(inventory ? 'files' : 'choose'); return; }
      setInventory(result); setFolder(label); setQuery('');
      setAutomatic(false); setAutomaticOffset(0);
      setSelectedFiles(new Set(result.files.filter(file => file.recommended).slice(0, LOCAL_SELECTION_LIMIT).map(file => file.id)));
      setItems([]); setRecords({}); setFailures([]); setRejected([]); setStep('files');
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause.message || '폴더를 읽지 못했어요. 접근 권한을 확인해주세요.');
      setStep(inventory ? 'files' : 'choose');
    }
  };

  const chooseFolder = async () => {
    if (!window.showDirectoryPicker) { inputRef.current?.click(); return; }
    try {
      const handle = await window.showDirectoryPicker({ id: 'fitpoly-experiences', mode: 'read' });
      await scan(handle, handle.name);
    } catch (cause) {
      if (cause.name !== 'AbortError') setError('폴더 선택 권한을 확인하거나 아래의 다른 방식으로 폴더를 선택해주세요.');
    }
  };

  const allowBrowserFolder = async () => {
    if (!window.showDirectoryPicker) { inputRef.current?.click(); return; }
    try {
      const handle = await window.showDirectoryPicker({ id: 'fitpoly-experience-search', mode: 'read' });
      await automaticSearch(false, false, handle);
    } catch (cause) {
      if (cause.name !== 'AbortError') setError('이 폴더에 접근하지 못했어요. 문서나 작업 자료가 있는 다른 폴더를 허용해주세요.');
    }
  };

  const organize = async () => {
    const controller = new AbortController();
    operation.current = controller;
    setStep('reading'); setError('');
    try {
      const result = await organizeLocalFiles(inventory.files.filter(file => selectedFiles.has(file.id)), {
        signal: controller.signal,
        onProgress: ({ current, total, path }) => setProgress(`${current}/${total} · ${path}`),
      });
      if (controller.signal.aborted) { setStep('files'); return; }
      setItems(result.items); setRecords({}); setFailures(result.failures);
      setSelectedItems(new Set(result.items.filter(item => !existingTitles.has(normalizeLocalTitle(item.title))).map(item => item.id)));
      setStep('review');
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause.message || '파일 정리에 실패했어요.');
      setStep('files');
    }
  };

  const merge = () => {
    const chosen = items.filter(item => selectedItems.has(item.id) && !records[item.id]);
    if (chosen.length < 2) return;
    const combined = mergeLocalCandidates(chosen);
    const nextItems = sortLocalExperiences([...items.filter(item => !chosen.some(row => row.id === item.id)), combined]);
    setItems(nextItems);
    if (automatic) setVisibleCount(previous => Math.max(previous, nextItems.findIndex(item => item.id === combined.id) + 1));
    setSelectedItems(new Set([combined.id]));
  };

  const separate = item => {
    const parts = splitLocalCandidate(item);
    const nextItems = sortLocalExperiences(items.flatMap(row => row.id === item.id ? parts : [row]));
    const nextSelected = new Set(selectedItems); nextSelected.delete(item.id);
    if (selectedItems.has(item.id)) parts.filter(part => part.coreSelection.eligible).forEach(part => nextSelected.add(part.id));
    setItems(nextItems); setSelectedItems(nextSelected);
    if (automatic) {
      const revealed = new Set([...nextSelected, ...parts.map(part => part.id)]);
      setVisibleCount(previous => Math.max(previous, ...nextItems.map((row, index) => revealed.has(row.id) ? index + 1 : 0)));
    }
  };

  const analyze = async () => {
    if (busy) return;
    if (!user?.uid) { setError('계정에 저장하려면 로그인해주세요.'); return; }
    const chosen = items.filter(item => selectedItems.has(item.id) && !savedIds.has(item.id));
    if (!chosen.length) return;
    if (chosen.some(item => !isExperienceTitle(item.title))) { setError('경험 제목에 프로젝트·활동 이름을 입력해주세요. 문장 조각이나 임시 제목은 확인이 필요해요.'); return; }
    stopRequested.current = false; setStopping(false);
    setStep('analyzing'); setError('');
    try {
      const result = await analyzeLocalExperiences({
        items: chosen, jobCategory, careerStage, momentsCount, records,
        createExperience: payload => createExperience(user.uid, payload), analyzeExperience,
        onRecord: (id, record) => setRecords(previous => ({ ...previous, [id]: record })),
        onProgress: ({ stage, item, current, total }) => setProgress(`${current}/${total} · ${item.title} · ${stage === 'saving' ? '자료 저장' : `${jobLabel} 핵심경험 분석`}`),
        shouldStop: () => stopRequested.current,
      });
      setRecords(result.records);
      setSelectedItems(new Set(chosen.filter(item => result.records[item.id]?.status !== 'complete').map(item => item.id)));
      if (result.failures.length) setError(`분석에 실패한 경험의 원문은 저장되어 있어요. 다시 시도하면 저장된 경험을 이어서 분석해요.${result.stopped ? ' 나머지 항목은 대기 중이에요.' : ''}\n${result.failures.map(failure => `${failure.title}: ${failure.message}`).join('\n')}`);
      else if (result.stopped) toast('현재 경험까지 처리했어요. 나머지는 이어서 분석할 수 있어요.');
      else {
        if (result.warnings.length) toast('일부 분석이 누락됐어요. 완료된 핵심 경험은 결과에서 확인할 수 있어요.');
        else toast.success(`경험 ${chosen.length}개를 ${jobLabel} 기준으로 정리했어요.`);
        if (chosen.length === 1) onOpenResult?.(result.records[chosen[0].id].experienceId);
      }
    } catch (cause) { setError(cause.response?.data?.error || cause.message || '분석을 완료하지 못했어요.'); }
    finally { setStep('review'); setStopping(false); }
  };

  const updateItem = (id, field, value) => setItems(previous => previous.map(item => {
    if (item.id !== id) return item;
    const next = { ...item, [field]: value, localEdits: { ...item.localEdits, [field]: value }, ...(field === 'title' ? { needsTitleReview: !isExperienceTitle(value) } : {}) };
    // Refresh the reason on this card without moving a focused field while typing.
    return sortLocalExperiences([next])[0];
  }));

  return (
    <section className="fp-local-import" aria-labelledby="local-import-heading" aria-busy={busy}>
      <div className="fp-local-header">
        <span className="fp-local-kicker"><FolderOpen size={16} /> 내 컴퓨터에서 찾기</span>
        <h2 id="local-import-heading">내 컴퓨터에서 경험 자료를 찾아올게요</h2>
        <p>폴더나 파일을 고르지 않아도, 내 파일과 로컬 드라이브에서 경험 자료를 자동으로 찾아요.</p>
        <p className="fp-local-help">이 사이트를 사용하는 각자의 PC에서 경험을 찾아요. 현재 이 브라우저가 열린 PC에만 연결해요.</p>
        <p className="fp-local-privacy">파일 탐색·읽기는 내 컴퓨터에서 진행해요. ‘직군별 분석 시작’을 누르면 선택한 내용·추출 원문·상대 경로가 서버에 저장되고 AI 분석에 사용돼요. 원본 파일은 업로드하지 않아요.</p>
      </div>
      <input ref={inputRef} type="file" webkitdirectory="" directory="" multiple className="hidden" aria-label="로컬 경험 폴더 선택"
        onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; if (files.length) void scan(files, files[0].webkitRelativePath?.split('/')[0] || '선택한 폴더', true); }} />
      {error && <p role="alert" className="fp-local-error">{error}</p>}

      {busy ? <div className="fp-local-progress" role="status" aria-live="polite">
        <Loader2 className="animate-spin" size={28} />
        <strong>{step === 'scanning' ? '폴더에서 파일을 찾고 있어요' : step === 'reading' ? '파일을 읽고 경험 후보를 찾고 있어요' : `${jobLabel} 관점에서 핵심경험을 정리하고 있어요`}</strong>
        <p>{progress}</p>
        {step === 'analyzing' ? <><p>기존 직군별 AI 분석과 동일하게 크레딧을 사용해요. 경험마다 몇 분 걸릴 수 있어요.</p><button className="fp-local-secondary" disabled={stopping} onClick={() => { stopRequested.current = true; setStopping(true); }}>{stopping ? '현재 경험을 마친 뒤 중단할게요' : '현재 경험 분석 후 중단'}</button></>
          : <button className="fp-local-secondary" onClick={() => operation.current?.abort()}>중단하기</button>}
      </div> : <>
        {step === 'choose' && <div className="fp-local-choose">
          <HardDrive size={38} />
          <h3>흩어진 경험 자료, 자동으로 찾아요</h3>
          <p>바탕화면·문서·다운로드·OneDrive와 로컬 드라이브를 탐색하고,<br />프로젝트·활동·성과 자료부터 읽어 경험 후보를 만들어요.</p>
          <button className="fp-local-primary" onClick={() => automaticSearch()}><Search size={17} /> 내 컴퓨터 자동 찾기</button>
          <button className="fp-local-secondary mt-3" onClick={allowBrowserFolder}><FolderOpen size={17} /> 설치 없이 폴더 접근 허용</button>
          <p className="fp-local-help">설치 없이 사용하면 허용한 폴더 안에서 경험을 자동으로 골라요. PC 전체 자동 탐색은 연결 기능을 한 번 설정해주세요.</p>
          <p className="fp-local-help">{import.meta.env.DEV ? '버튼을 누르면 자동으로 연결돼요. 브라우저가 로컬 네트워크 권한을 요청하면 허용해주세요.' : 'PC 자동 연결을 한 번 설정하면, 다음부터 버튼만 눌러 탐색해요.'}</p>
          {connectorMissing && <div className="fp-local-setup"><strong>현재 사용하는 내 PC에 자동 연결 설정</strong><p>최초 한 번 아래 파일의 압축을 풀고 <b>FitPoly-자동연결-설정.cmd</b>를 실행해주세요. 현재 방문자 본인의 Windows 계정에 연결 기능을 설치하고 로그인할 때 자동으로 준비해요. 파일 탐색은 사이트에서 버튼을 눌렀을 때만 시작해요.</p><a href="/local-experience-connector/fitpoly-local-connector-win.zip" download className="fp-local-secondary"><Download size={16} /> Windows 자동 연결 다운로드</a><p>이미 설정했다면 아래 연결을 열고, 브라우저의 앱 열기·로컬 네트워크 권한을 허용해주세요.</p><a href="fitpoly-local://connect" className="fp-local-secondary" onClick={() => { void automaticSearch(false, true); }}>설정한 PC 연결 열기</a><p className="fp-local-help">자동 연결 해제는 설치 폴더의 remove-connection.ps1로 할 수 있어요.</p></div>}
          <details className="fp-local-manual"><summary>특정 폴더에서만 찾고 싶다면</summary><button className="fp-local-secondary" onClick={chooseFolder}><FolderOpen size={17} /> 폴더 선택하기</button></details>
          <p className="fp-local-help">TXT · MD · CSV · PDF · DOCX · PPTX · HWPX / 파일당 25MB<br />스캔 PDF, 이미지, HWP·DOC 파일은 기존 자료 가져오기를 이용해주세요.</p>
        </div>}

        {step === 'files' && inventory && <div className="fp-local-body">
          <div className="fp-local-toolbar"><div><h3>{folder}</h3><p>정리 가능한 파일 {inventory.files.length}개 · {selectedFiles.size}개 선택</p></div>
            <button className="fp-local-secondary" onClick={chooseFolder}><RefreshCw size={14} /> 다른 폴더 선택</button></div>
          {inventory.limited && <p role="status" className="fp-local-warning">탐색 한도(파일 1,000개·전체 항목 10,000개·하위 32단계)에 도달했어요. 작은 폴더로 나눠 선택해주세요.</p>}
          {Object.keys(inventory.skipped).length > 0 && <p className="fp-local-help">제외: {Object.entries(inventory.skipped).map(([reason, count]) => `${reason} ${count}개`).join(' · ')}</p>}
          <label className="fp-local-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="파일명이나 폴더명으로 찾기" aria-label="파일 목록 검색" /></label>
          <div className="fp-local-toolbar"><p>경험 관련 이름의 파일을 먼저 선택했어요. 필요한 파일을 직접 골라도 좋아요.</p>
            <div className="fp-local-actions"><button className="fp-local-text" onClick={() => setSelectedFiles(new Set(visibleFiles.slice(0, LOCAL_SELECTION_LIMIT).map(file => file.id)))}>검색 결과 선택 (최대 30개)</button><button className="fp-local-text" onClick={() => setSelectedFiles(new Set())}>선택 해제</button></div></div>
          <ul className="fp-local-files">
            {visibleFiles.map(file => <li key={file.id}><label>
              <input type="checkbox" checked={selectedFiles.has(file.id)} onChange={() => {
                if (!selectedFiles.has(file.id) && selectedFiles.size >= LOCAL_SELECTION_LIMIT) { toast.error('한 번에 최대 30개까지 선택할 수 있어요.'); return; }
                setSelectedFiles(previous => toggle(previous, file.id));
              }} />
              <span><strong>{file.name}</strong><span>{file.path}</span></span><small>{formatSize(file.size)}</small>
            </label></li>)}
          </ul>
          {!visibleFiles.length && <p className="fp-local-empty">{inventory.files.length ? '검색어에 맞는 파일이 없어요.' : '지원하는 문서 파일이 없어요. 다른 폴더를 선택해주세요.'}</p>}
          <div className="fp-local-footer"><p>선택한 파일만 읽어요. 한 번에 최대 30개·합계 150MB.</p><button className="fp-local-primary" disabled={!selectedFiles.size} onClick={organize}>선택한 {selectedFiles.size}개 파일 정리 <ArrowRight size={16} /></button></div>
        </div>}

        {step === 'review' && <div className="fp-local-body">
          <div className="fp-local-toolbar"><div><h3>경험 후보 총 {items.length}개를 찾았어요</h3><p>내 기여와 결과가 구체적으로 확인되는 경험부터 보여드려요. 같은 프로젝트의 자료는 묶고, 부족한 내용은 보완하며 남길 수 있어요.</p></div>
            <button className="fp-local-secondary" onClick={() => automatic ? automaticSearch() : setStep('files')}>{automatic ? '내 컴퓨터 다시 찾기' : '파일 다시 고르기'}</button></div>
          {automatic && <div className="fp-local-auto-summary"><p>{inventory.roots?.join(' · ')}에서 문서 {inventory.files.length.toLocaleString()}개 발견 · 드라이브별 관련 자료를 고르게 {automaticOffset}개 자동 확인</p>
            {inventory.rootStats?.length > 0 && <details className="fp-local-root-status" open={inventory.rootStats.some(root => root.state === 'inaccessible')}><summary>위치별 탐색 결과</summary><ul>{inventory.rootStats.map((root, index) => <li key={`${root.label}:${index}`}><strong>{root.label}</strong><span>{ROOT_STATES[root.state] || root.state} · 문서 {root.found.toLocaleString()}개{root.inaccessible > 0 ? ` · 접근 불가 폴더 ${root.inaccessible}개` : ''}</span></li>)}</ul></details>}
            {inventory.limited && <p className="fp-local-warning">탐색 한도에 도달했어요. 일부 위치는 아직 확인하지 못했어요.</p>}{automaticOffset < inventory.files.length && <button className="fp-local-secondary" onClick={() => automaticSearch(true)}>다음 자료에서 경험 더 찾기 ({Math.min(LOCAL_SELECTION_LIMIT, inventory.files.length - automaticOffset)}개)</button>}</div>}
          <div className="fp-local-analysis-options">
            <label>분석할 직군<select aria-label="분석할 직군" value={jobCategory} disabled={Object.keys(records).length > 0} onChange={event => setJobCategory(event.target.value)}>{JOB_CATEGORIES.map(group => <optgroup key={group.group} label={group.group}>{group.items.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>)}</select></label>
            <label>경력 단계<select aria-label="분석 경력 단계" value={careerStage} disabled={Object.keys(records).length > 0} onChange={event => setCareerStage(event.target.value)}>{CAREER_STAGES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>경험당 핵심경험 수<select aria-label="핵심경험 수" value={momentsCount} disabled={Object.keys(records).length > 0} onChange={event => setMomentsCount(Number(event.target.value))}>{[3, 4, 5, 6, 7, 8, 9, 10].map(count => <option key={count} value={count}>{count}개</option>)}</select></label>
          </div>
          <p className="fp-local-help">{JOB_OPTIONS.find(option => option.value === jobCategory)?.description} · 텍스트 추출은 무료이며, 직군별 AI 분석은 기존과 동일하게 크레딧을 사용해요.</p>
          {rejected.length > 0 && <details className="fp-local-filter-summary"><summary>참고·예시·근거 부족 자료 {rejected.length}개를 제외했어요</summary><ul>{rejected.slice(0, 20).map((entry, index) => <li key={`${entry.path}:${index}`}><strong>{entry.title || entry.path.split('/').at(-1)}</strong><span>{entry.reason}</span></li>)}</ul>{rejected.length > 20 && <p>그 외 {rejected.length - 20}개 자료도 같은 기준으로 제외했어요.</p>}</details>}
          {failures.length > 0 && <details className="fp-local-warning"><summary>읽지 못한 파일 {failures.length}개</summary><ul>{failures.map(failure => <li key={failure.path}>{failure.path}: {failure.message}</li>)}</ul></details>}
          {automatic && items.length > CORE_EXPERIENCE_LIMIT && <details className="fp-local-filter-summary fp-local-experience-index"><summary>찾은 경험 전체 목록 ({items.length}개 · 현재 {visibleItems.length}개 표시)</summary><ul>{items.map((item, index) => <li key={item.id}><button className="fp-local-text" onClick={() => {
            setVisibleCount(previous => Math.max(previous, index + 1));
            requestAnimationFrame(() => document.getElementById(`fp-local-exp-${encodeURIComponent(item.id)}`)?.scrollIntoView({ block: 'start' }));
          }}>{index + 1}. {item.title} · 자료 {item.sourcePaths.length}개</button></li>)}</ul></details>}
          <div className="fp-local-toolbar"><div className="fp-local-actions"><button className="fp-local-text" onClick={() => setSelectedItems(new Set(visibleItems.filter(item => !savedIds.has(item.id)).map(item => item.id)))}>모두 선택</button><button className="fp-local-text" onClick={() => setSelectedItems(new Set())}>선택 해제</button></div>
            <button className="fp-local-secondary" disabled={items.filter(item => selectedItems.has(item.id) && !records[item.id]).length < 2} onClick={merge}>선택한 후보 하나로 합치기</button></div>
          <div className="fp-local-candidates">
            {visibleItems.map(item => <article id={`fp-local-exp-${encodeURIComponent(item.id)}`} key={item.id} className={`fp-local-candidate ${savedIds.has(item.id) ? 'is-saved' : ''}`}>
              <div className="fp-local-candidate-top"><label><input type="checkbox" checked={selectedItems.has(item.id)} disabled={savedIds.has(item.id)} onChange={() => setSelectedItems(previous => toggle(previous, item.id))} /><span>{savedIds.has(item.id) ? item.hasNewLocalSources ? '추가 자료 포함 · 기존 분석 결과' : '직군별 분석 완료' : records[item.id] ? '자료 저장됨 · 분석 재시도' : '이 경험 분석하기'}</span></label>
                <div className="fp-local-candidate-status">{item.recommendation?.recommended && <span className="fp-local-recommendation-badge">추천 경험</span>}{item.needsReview && <small>내용 확인 필요</small>}</div></div>
              {item.recommendation?.recommended && item.recommendation.reasons?.length > 0 && <p className="fp-local-recommendation" aria-label="추천 이유">{item.recommendation.reasons.slice(0, 3).join(' · ')}</p>}
              {item.coreSelection && <p className="fp-local-evidence-note">{item.coreSelection.missing?.length ? `${item.coreSelection.missing.join(' · ')} 보완 필요 · 확인된 행동을 바탕으로 포함했어요` : 'STAR 근거를 확인했어요'}</p>}
              {item.separateExperience && <p className="fp-local-help">직접 나눈 경험이에요. 다시 합치려면 후보를 선택해주세요.</p>}
              {item.hasNewLocalSources && records[item.id] && <p className="fp-local-help">추가 자료를 원문에 함께 표시했어요. 저장된 경험과 기존 분석 결과에는 이전 자료가 보존되어 있어요.</p>}
              <label className="fp-local-title">경험 제목<input value={editableText(item.title)} maxLength={200} disabled={Boolean(records[item.id])} onChange={event => updateItem(item.id, 'title', event.target.value)} /></label>
              {item.mergeReasons?.length > 0 && <div className="fp-local-evidence-note"><strong>관련 자료 {item.sourcePaths.length}개를 하나의 경험으로 묶었어요.</strong><ul>{item.mergeReasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
                {item.localParts?.length > 1 && !records[item.id] && <button className="fp-local-text" onClick={() => separate(item)}>다른 경험이면 묶음 나누기</button>}</div>}
              {existingTitles.has(normalizeLocalTitle(item.title)) && !records[item.id] && <p className="fp-local-warning">같은 제목의 경험이 이미 있어요. 추가할 항목인지 확인해주세요.</p>}
              <div className="fp-local-fields">{Object.entries(FIELD_LABELS).map(([field, label]) => <label key={field}>{label}<textarea value={editableText(item[field])} rows={field === 'period' || field === 'role' ? 1 : 3} maxLength={8000} disabled={Boolean(records[item.id])} placeholder="자료에서 확인되지 않았어요. 알고 있는 내용을 채워주세요." onChange={event => updateItem(item.id, field, event.target.value)} /></label>)}</div>
              <details className="fp-local-source"><summary>출처·원문 확인 ({item.sourcePaths.length}개 파일)</summary><ul>{item.sourcePaths.map(path => <li key={path}>{path}</li>)}</ul><pre>{materialPlainText(item.localDocuments?.length ? item.localDocuments.map(document => `--- ${document.path} ---\n${document.text}`).join('\n\n') : item.sourceText)}</pre></details>
              {records[item.id] && <button className="fp-local-secondary mt-3" onClick={() => onOpenResult?.(records[item.id].experienceId)}>{savedIds.has(item.id) ? '직군별 핵심경험 결과 보기' : '저장된 경험 보기'} <ArrowRight size={15} /></button>}
            </article>)}
          </div>
          {automatic && items.length > visibleItems.length && <button className="fp-local-secondary mt-4" onClick={() => setVisibleCount(previous => previous + CORE_EXPERIENCE_LIMIT)}>근거 있는 다른 핵심경험 더 보기 ({items.length - visibleItems.length}개)</button>}
          {!items.length && <p className="fp-local-empty">{automatic ? '직접 한 일이 드러나는 경험을 아직 찾지 못했어요. 다음 자료에서도 계속 찾아볼 수 있어요.' : '정리할 경험을 찾지 못했어요. 다른 문서를 선택해주세요.'}</p>}
          <div className="fp-local-footer"><p>직군별 핵심경험·역량·성과를 기존 결과 화면에서 확인해요. 최종 사실 확인은 분석 후 진행해요.</p><div className="fp-local-actions">
            {Object.keys(records).length > 0 && <button className="fp-local-secondary" onClick={onImported}><Check size={15} /> 경험 목록 보기</button>}
            <button className="fp-local-primary" disabled={!selectedItems.size} onClick={analyze}>직군별 분석 시작 ({selectedItems.size}개) <ArrowRight size={16} /></button>
          </div></div>
        </div>}
        {!automatic && <div className="fp-local-fallback"><button className="fp-local-text" onClick={() => inputRef.current?.click()}>폴더 선택이 안 되면 다른 방식으로 선택하기</button></div>}
      </>}
    </section>
  );
}
