/**
 * ProjectDetailModal — 프로젝트(경험) 상세 모달 (편집/미리보기/링크공유 공용).
 *
 * 본문은 하나의 자유 노션 캔버스(NotionDocEditor)로 편집한다.
 *  - 좌측: 팔레트(내 경험 + 빈 섹션) — 드래그하여 캔버스에 삽입 (편집 모드)
 *  - 중앙: 속성 헤더(기간/역할/기술/키워드/목표/링크 + 핵심경험) + 자유 캔버스
 *  - 우측: AI 첨삭 패널 (jobAnalysis 연결 시, 편집 모드)
 *
 * Props:
 *  - exp: 프로젝트(경험) 객체. 캔버스는 exp.notionDoc(Yoopta JSON)에 저장.
 *  - readOnly: 읽기전용(미리보기·링크공유)
 *  - onUpdate(changes): 편집 모드에서 변경 저장
 *  - onClose, jobAnalysis, resizeToBase64, userExperiences, genericMode
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { X, ExternalLink, ImagePlus, PenLine, Check, Loader2, Layers, FileText, GripVertical, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import KeyExperienceSlider from './KeyExperienceSlider';
import { NotionDocEditor, CUSTOM_PALETTE_DRAG_TYPE } from './YooptaMiniEditor';
import {
  buildNotionDocFromExperience,
  sectionTemplateToBlocks,
  experienceToBlocks,
  tailoredToBlocks,
  getSectionTemplates,
  extractSectionsFromDoc,
} from '../utils/projectSections';
import { stripMd } from '../utils/textUtils';

export default function ProjectDetailModal({
  exp,
  readOnly = false,
  onUpdate,
  onClose,
  jobAnalysis,
  resizeToBase64,
  userExperiences = [],
  genericMode = false,
}) {
  const structured = exp?.structuredResult || {};
  const overview = structured.projectOverview || {};

  // ── Firestore 섹션 이미지 로드 (마이그레이션 보존용) ──
  const [allImages, setAllImages] = useState([]);
  const [sectionImages, setSectionImages] = useState({});
  const [imageConfig, setImageConfig] = useState({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  useEffect(() => {
    const expId = exp?.experienceId;
    if (!expId) { setImagesLoaded(true); return; }
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'experiences', expId));
        if (snap.exists() && alive) {
          const data = snap.data();
          setAllImages(data.images || []);
          setSectionImages(data.sectionImages || {});
          setImageConfig(data.imageConfig || {});
        }
      } catch { /* 이미지 로드 실패는 무시 */ }
      if (alive) setImagesLoaded(true);
    })();
    return () => { alive = false; };
  }, [exp?.experienceId]);

  // ── 캔버스 초기 문서: 저장된 notionDoc 우선, 없으면 기존 섹션 → 노션 블록 변환 ──
  const hasSavedDoc = exp?.notionDoc && Object.keys(exp.notionDoc).length > 0;
  const initialDoc = useMemo(() => {
    if (hasSavedDoc) return exp.notionDoc;
    if (!imagesLoaded) return null;
    return buildNotionDocFromExperience(exp, { allImages, sectionImages, imageConfig });
  }, [hasSavedDoc, exp, imagesLoaded, allImages, sectionImages, imageConfig]);

  const docValueRef = useRef(initialDoc);
  useEffect(() => { if (initialDoc) docValueRef.current = initialDoc; }, [initialDoc]);
  const canvasRef = useRef(null);

  const handleDocChange = (nextDoc) => {
    docValueRef.current = nextDoc;
    onUpdate?.({ notionDoc: nextDoc });
  };

  // ── 메타(속성) 인라인 편집 ──
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState(null);
  const openMetaEdit = () => {
    setMetaDraft({
      title: exp?.title || '',
      date: exp?.date || overview.duration || '',
      role: exp?.role || overview.role || '',
      skills: (exp?.skills || []).join(', '),
      keywords: (exp?.keywords || []).map(k => (typeof k === 'string' ? k : k?.name || k?.keyword || '')).join(', '),
      goal: overview.goal || '',
      description: exp?.description || overview.background || overview.summary || '',
      link: exp?.link || '',
      thumbnailUrl: exp?.thumbnailUrl || '',
    });
    setEditingMeta(true);
  };
  const saveMetaEdit = () => {
    if (!metaDraft) return;
    const skills = metaDraft.skills.split(',').map(s => s.trim()).filter(Boolean);
    const keywords = metaDraft.keywords.split(',').map(s => s.trim()).filter(Boolean);
    onUpdate?.({
      title: metaDraft.title,
      date: metaDraft.date,
      role: metaDraft.role,
      skills,
      keywords,
      description: metaDraft.description,
      link: metaDraft.link,
      thumbnailUrl: metaDraft.thumbnailUrl,
      structuredResult: {
        ...structured,
        projectOverview: { ...overview, duration: metaDraft.date, role: metaDraft.role, goal: metaDraft.goal },
      },
    });
    setEditingMeta(false);
  };

  // ── AI 첨삭 ──
  const [tailorOpen, setTailorOpen] = useState(false);
  const [tailorResult, setTailorResult] = useState(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState(null);
  const [appliedSections, setAppliedSections] = useState({});

  const runTailor = async () => {
    if (!jobAnalysis) return;
    setTailoring(true);
    setTailorError(null);
    setAppliedSections({});
    try {
      const sections = extractSectionsFromDoc(docValueRef.current)
        .map((s, i) => ({ key: s.key || `section-${i}`, title: s.label, content: s.content }))
        .filter(s => s.content.trim());
      if (sections.length === 0) {
        setTailorResult({ sections: [], overallNote: '첨삭할 본문 내용이 없습니다.' });
        setTailoring(false);
        return;
      }
      const { data } = await api.post('/job/tailor-portfolio', { jobAnalysis, sections });
      setTailorResult({
        ...data,
        portfolioSections: (data.sections || []).map(item => ({
          ...item,
          label: sections[item.index]?.title,
        })),
      });
    } catch (err) {
      setTailorError(err.response?.data?.error || 'AI 첨삭에 실패했습니다');
    }
    setTailoring(false);
  };

  const openTailor = () => {
    if (tailorOpen) { setTailorOpen(false); return; }
    setTailorOpen(true);
    setTailorResult(null);
    setTailorError(null);
    runTailor();
  };

  const applyTailoredSection = (idx, label, content) => {
    if (!content?.trim()) return;
    canvasRef.current?.insertBlocks(tailoredToBlocks(label, content));
    setAppliedSections(prev => ({ ...prev, [idx]: true }));
  };
  const applyAllTailored = () => {
    const list = (tailorResult?.portfolioSections || []).filter(s => s.tailoredContent?.trim());
    list.forEach((s, i) => canvasRef.current?.insertBlocks(tailoredToBlocks(s.label, s.tailoredContent)));
    setAppliedSections(Object.fromEntries(list.map((_, i) => [i, true])));
  };

  // ── 팔레트 드래그 → 블록 변환 ──
  const resolvePaletteBlocks = (payload) => {
    if (payload?.kind === 'section') return sectionTemplateToBlocks(payload.label);
    if (payload?.kind === 'experience') {
      const found = userExperiences.find(e => (e.id || e.experienceId) === payload.id);
      return found ? experienceToBlocks(found) : [];
    }
    return [];
  };

  if (!exp) return null;

  const duration = overview.duration || exp.date || '';
  const role = overview.role || exp.role || '';
  const techStack = (overview.techStack?.length > 0 ? overview.techStack : null) || (exp.skills?.length > 0 ? exp.skills : null) || [];
  const keywords = exp.keywords || [];
  const goal = overview.goal || '';
  const coverImg = structured.exportConfig?.coverImg || exp.thumbnailUrl || null;
  const keyExps = (structured.keyExperiences || []).filter(Boolean);
  const description = exp.description || overview.background || overview.summary || '';
  const sectionTemplates = getSectionTemplates(exp?.jobCategory || structured.exportConfig?.jobCategory);

  const showPalette = !readOnly;
  const showTailorPanel = !readOnly && tailorOpen;

  return (
    <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col h-[92vh] transition-all duration-300"
        style={{ width: showTailorPanel ? 'min(1700px, calc(100vw - 24px))' : 'min(1400px, calc(100vw - 24px))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 truncate max-w-[520px]">{exp.title || (genericMode ? '카드 상세' : '경험 상세')}</h3>
            {!readOnly && (
              <button
                onClick={() => (editingMeta ? setEditingMeta(false) : openMetaEdit())}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all border ${editingMeta ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-primary-700 border-primary-200 hover:bg-primary-50'}`}
              >
                {editingMeta ? '닫기' : '정보 수정'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && jobAnalysis && !genericMode && (
              <button
                onClick={openTailor}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${tailorOpen ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'}`}
              >
                <Sparkles size={13} /> AI 첨삭
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* ── 좌측 팔레트 ── */}
          {showPalette && (
            <div className="w-[230px] flex-shrink-0 border-r border-gray-100 bg-[#fafaf8] overflow-y-auto p-3">
              <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">드래그하여 추가</p>

              <div className="mt-2 flex items-center gap-1.5 px-1 text-[12px] font-bold text-gray-600"><FileText size={13} /> 빈 섹션</div>
              <div className="mt-1.5 space-y-1">
                {sectionTemplates.map(tpl => (
                  <div
                    key={tpl.key}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData(CUSTOM_PALETTE_DRAG_TYPE, JSON.stringify({ kind: 'section', label: tpl.label }));
                    }}
                    className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[13px] text-gray-700 cursor-grab active:cursor-grabbing hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                  >
                    <GripVertical size={12} className="text-gray-300 group-hover:text-primary-400" />
                    <span className="truncate">{tpl.label}</span>
                  </div>
                ))}
              </div>

              {userExperiences.length > 0 && (
                <>
                  <div className="mt-4 flex items-center gap-1.5 px-1 text-[12px] font-bold text-gray-600"><Layers size={13} /> 내 경험</div>
                  <div className="mt-1.5 space-y-1">
                    {userExperiences.map(e => (
                      <div
                        key={e.id || e.experienceId}
                        draggable
                        onDragStart={ev => {
                          ev.dataTransfer.effectAllowed = 'copy';
                          ev.dataTransfer.setData(CUSTOM_PALETTE_DRAG_TYPE, JSON.stringify({ kind: 'experience', id: e.id || e.experienceId }));
                        }}
                        className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[13px] text-gray-700 cursor-grab active:cursor-grabbing hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
                        title={e.title}
                      >
                        <GripVertical size={12} className="text-gray-300 group-hover:text-emerald-400" />
                        <span className="truncate">{e.title || '(제목 없음)'}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── 중앙: 속성 헤더 + 캔버스 ── */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {coverImg && (
              <div className="w-full h-40 bg-surface-50">
                <img src={coverImg} alt="cover" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="px-10 pb-12 pt-8 max-w-3xl mx-auto">
              {/* 메타 편집 폼 */}
              {editingMeta && metaDraft && (
                <div className="mb-6 bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">제목</label>
                    <input value={metaDraft.title} onChange={e => setMetaDraft(d => ({ ...d, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">기간</label>
                      <input value={metaDraft.date} onChange={e => setMetaDraft(d => ({ ...d, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '보조 정보' : '역할'}</label>
                      <input value={metaDraft.role} onChange={e => setMetaDraft(d => ({ ...d, role: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '태그 (쉼표로 구분)' : '기술 (쉼표로 구분)'}</label>
                    <input value={metaDraft.skills} onChange={e => setMetaDraft(d => ({ ...d, skills: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">키워드 (쉼표로 구분)</label>
                    <input value={metaDraft.keywords} onChange={e => setMetaDraft(d => ({ ...d, keywords: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '메모 / 한줄평' : '목표'}</label>
                    <textarea value={metaDraft.goal} onChange={e => setMetaDraft(d => ({ ...d, goal: e.target.value }))}
                      rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '상세 내용' : '간단한 소개'}</label>
                    <textarea value={metaDraft.description} onChange={e => setMetaDraft(d => ({ ...d, description: e.target.value }))}
                      rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">링크 (선택)</label>
                    <input value={metaDraft.link} onChange={e => setMetaDraft(d => ({ ...d, link: e.target.value }))} placeholder="https://"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">대표 이미지 (선택)</label>
                    <div className="flex items-center gap-3">
                      {metaDraft.thumbnailUrl && <img src={metaDraft.thumbnailUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />}
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                        <ImagePlus size={14} /> 이미지 선택
                        <input type="file" accept="image/*" className="hidden" onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file || !resizeToBase64) return;
                          try { const url = await resizeToBase64(file, 800, 0.8); setMetaDraft(d => ({ ...d, thumbnailUrl: url })); }
                          catch { toast.error('이미지 처리에 실패했습니다'); }
                        }} />
                      </label>
                      {metaDraft.thumbnailUrl && (
                        <button type="button" onClick={() => setMetaDraft(d => ({ ...d, thumbnailUrl: '' }))} className="text-xs text-gray-400 hover:text-red-500">이미지 제거</button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingMeta(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">취소</button>
                    <button onClick={saveMetaEdit} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700">저장</button>
                  </div>
                </div>
              )}

              {/* 제목 (읽기전용에서만 표시 — 헤더에 이미 있지만 문서 느낌) */}
              {readOnly && (
                <h1 className="text-[28px] font-extrabold text-primary-600 leading-tight mb-5">{exp.title || '(제목 없음)'}</h1>
              )}

              {/* 속성 헤더 */}
              {(duration || role || techStack.length > 0 || keywords.length > 0 || goal || exp.link) && (
                <div className="space-y-2 border-b border-surface-100 pb-5 mb-6">
                  {duration && (
                    <div className="flex items-center gap-4"><span className="w-14 text-[14px] text-gray-400 flex-shrink-0">기간</span><span className="text-[15px] text-gray-700">{duration}</span></div>
                  )}
                  {role && (
                    <div className="flex items-start gap-4"><span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">역할</span><span className="text-[15px] text-gray-700 leading-relaxed">{role}</span></div>
                  )}
                  {techStack.length > 0 && (
                    <div className="flex items-start gap-4">
                      <span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">기술</span>
                      <div className="flex flex-wrap gap-1.5">{techStack.map((t, i) => <span key={i} className="px-2 py-0.5 bg-surface-100 text-gray-600 rounded text-[14px]">{typeof t === 'string' ? t : t?.name || ''}</span>)}</div>
                    </div>
                  )}
                  {keywords.length > 0 && (
                    <div className="flex items-start gap-4">
                      <span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">키워드</span>
                      <div className="flex flex-wrap gap-1.5">{keywords.slice(0, 6).map((kw, i) => <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-500 rounded text-[14px] font-medium">{typeof kw === 'string' ? kw : kw?.name || kw?.keyword || ''}</span>)}</div>
                    </div>
                  )}
                  {goal && (
                    <div className="flex items-start gap-4"><span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">목표</span><span className="text-[15px] text-gray-700 leading-relaxed">{goal}</span></div>
                  )}
                  {exp.link && (
                    <div className="flex items-center gap-4">
                      <span className="w-14 text-[14px] text-gray-400 flex-shrink-0">링크</span>
                      <a href={exp.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[15px] text-primary-600 hover:underline break-all"><ExternalLink size={12} /> {exp.link}</a>
                    </div>
                  )}
                </div>
              )}

              {/* 설명 */}
              {description && (
                <p className="text-sm text-gray-600 leading-relaxed bg-surface-50 rounded-xl p-4 mb-6">{description}</p>
              )}

              {/* 핵심 경험 */}
              {keyExps.length > 0 && (
                <div className="mb-8">
                  <h4 className="text-[14px] font-bold uppercase tracking-widest text-gray-400 border-b border-surface-100 pb-2 mb-4">핵심 경험 &amp; 성과</h4>
                  <KeyExperienceSlider
                    keyExperiences={keyExps}
                    onUpdate={readOnly ? undefined : (updated => onUpdate?.({ structuredResult: { ...structured, keyExperiences: updated } }))}
                  />
                </div>
              )}

              {/* ── 자유 캔버스 ── */}
              <div>
                <h4 className="text-[14px] font-bold uppercase tracking-widest text-gray-400 border-b border-surface-100 pb-2 mb-3">상세 내용</h4>
                {initialDoc ? (
                  <NotionDocEditor
                    key={exp.experienceId || exp.id || exp.title || 'project'}
                    ref={canvasRef}
                    value={initialDoc}
                    onChange={readOnly ? undefined : handleDocChange}
                    readOnly={readOnly}
                    resolvePaletteBlocks={resolvePaletteBlocks}
                  />
                ) : (
                  <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 size={20} className="animate-spin" /></div>
                )}
              </div>
            </div>
          </div>

          {/* ── 우측 AI 첨삭 패널 ── */}
          {showTailorPanel && (
            <div className="flex-shrink-0 border-l border-gray-100 overflow-y-auto bg-gradient-to-b from-indigo-50/30 to-white" style={{ width: 'clamp(320px, 34vw, 400px)' }}>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-indigo-800">AI 첨삭</h4>
                  {tailorResult && !tailoring && (
                    <button onClick={runTailor} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">다시 첨삭</button>
                  )}
                </div>
                {jobAnalysis?.company && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-xs font-medium text-blue-800">{jobAnalysis.company}</span>
                    {jobAnalysis.position && <span className="text-xs text-blue-500">· {jobAnalysis.position}</span>}
                  </div>
                )}
                {tailoring && (
                  <div className="flex flex-col items-center py-10">
                    <Loader2 size={24} className="animate-spin text-indigo-400 mb-3" />
                    <p className="text-sm text-gray-500">첨삭 중입니다...</p>
                    <p className="text-xs text-gray-400 mt-1">본문을 기업에 맞게 재구성합니다</p>
                  </div>
                )}
                {tailorError && !tailoring && (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-xs text-red-600">{tailorError}</p>
                    <button onClick={runTailor} className="text-xs text-red-500 hover:text-red-700 mt-1 underline">다시 시도</button>
                  </div>
                )}
                {tailorResult && !tailoring && (
                  <div className="space-y-3">
                    {tailorResult.overallNote && (tailorResult.portfolioSections || []).length === 0 && (
                      <p className="text-[12px] text-gray-500 italic bg-gray-50 rounded-xl px-3 py-2">{tailorResult.overallNote}</p>
                    )}
                    {(tailorResult.portfolioSections || []).filter(s => s.tailoredContent?.trim()).length > 0 && (
                      <button onClick={applyAllTailored} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                        전체 적용 (캔버스에 삽입)
                      </button>
                    )}
                    {(tailorResult.portfolioSections || []).map((section, i) => {
                      const content = section.tailoredContent;
                      if (!content?.trim()) return null;
                      const isApplied = appliedSections[i];
                      return (
                        <div key={i} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                          <div className="flex items-center gap-2 px-3 py-2 bg-surface-50 border-b border-gray-100">
                            <span className="text-xs font-bold text-gray-700 flex-1 truncate">{section.label || '섹션'}</span>
                            <button
                              onClick={() => applyTailoredSection(i, section.label, content)}
                              disabled={isApplied}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-medium transition-colors ${isApplied ? 'bg-green-100 text-green-700 cursor-default' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'}`}
                            >
                              {isApplied ? <><Check size={10} />적용됨</> : <>적용</>}
                            </button>
                          </div>
                          <div className="p-3">
                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{stripMd(content)}</p>
                            {(section.reason || section.changeReason) && (
                              <p className="text-[12px] text-indigo-500 mt-2 pt-2 border-t border-gray-50 italic">{stripMd(section.reason || section.changeReason)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {tailorResult.highlightedSkills?.length > 0 && (
                      <div className="pt-2">
                        <p className="text-[12px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">기업 어필 스킬</p>
                        <div className="flex flex-wrap gap-1.5">{tailorResult.highlightedSkills.map((s, si) => <span key={si} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[12px] font-medium">{s}</span>)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
