import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, Save, Loader2, HelpCircle, ImagePlus, X, Image, GripVertical, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FRAMEWORKS } from '../../stores/experienceStore';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';

// sectionImages 형식: { [sectionKey]: BlockItem[] }
// BlockItem: { type: 'image', url, name, width: 25|50|75|100, align: 'left'|'center'|'right' }

// 평귤 업그레이드 폈트: 이전 { url, storagePath, name, x, y, width } 형식을 BlockItem로 변환
function migrateImages(old) {
  if (!old || !Array.isArray(old)) return [];
  return old.map(img => ({
    type: 'image',
    url: img.url,
    name: img.name || '',
    width: 50,
    align: 'center',
  }));
}

// 이미지를 Canvas로 압축 → base64 반환 (max 800px, JPEG 75%)
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const SECTION_KEYS = ['projectName', 'period', 'reason', 'solution', 'solutionReason', 'skills', 'result'];

const SECTION_LABELS_DEFAULT = {
  projectName: '프로젝트명',
  period: '기간',
  reason: 'Overview & Summary / 역할 및 기여도',
  solution: '🏆 Key Result / 핵심 성과',
  solutionReason: '🎯 Problem Definition / 문제 정의 (Why)',
  skills: '💡 Action & Strategy / 실행 전략 (How)',
  result: '📊 Insight & Learnings / 인사이트 및 성장',
};

function getSectionLabels(structured) {
  return {
    projectName: SECTION_LABELS_DEFAULT.projectName,
    period: SECTION_LABELS_DEFAULT.period,
    reason: SECTION_LABELS_DEFAULT.reason,
    solution: structured?.section1Label || SECTION_LABELS_DEFAULT.solution,
    solutionReason: structured?.section2Label || SECTION_LABELS_DEFAULT.solutionReason,
    skills: structured?.section3Label || SECTION_LABELS_DEFAULT.skills,
    result: structured?.section4Label || SECTION_LABELS_DEFAULT.result,
  };
}

// 하위 호환 (placeholder ref)
const SECTION_LABELS = SECTION_LABELS_DEFAULT;

const SECTION_COLORS = {
  projectName: 'border-blue-200 bg-blue-50',
  period: 'border-indigo-200 bg-indigo-50',
  reason: 'border-purple-200 bg-purple-50',
  solution: 'border-violet-200 bg-violet-50',
  solutionReason: 'border-pink-200 bg-pink-50',
  skills: 'border-amber-200 bg-amber-50',
  result: 'border-emerald-200 bg-emerald-50',
};

// 하이라이트 색상
const highlightColors = {
  core: { bg: 'bg-red-100', border: 'border-red-300', label: '핵심 역량', dot: 'bg-red-400' },
  derived: { bg: 'bg-amber-100', border: 'border-amber-300', label: '파생 역량', dot: 'bg-amber-400' },
  growth: { bg: 'bg-green-100', border: 'border-green-300', label: '성장 관점', dot: 'bg-green-400' },
};

// ======================================================
// 블록 모델: { type:'text', content:string } | { type:'image', url, name, width, align }
// sectionBlocks[sectionKey] = Block[] — 텍스트와 이미지가 한 리스트에 함께 저장되며 순서를 지님
// ======================================================

function buildSectionBlocks(structuredResult, sectionImagesData, sectionBlocksData) {
  const result = {};
  for (const key of SECTION_KEYS) {
    const text = typeof structuredResult?.[key] === 'string' ? structuredResult[key] : '';
    // 이미 새 형식으로 저장된 경우 재활용 (text content만 최신화)
    if (sectionBlocksData?.[key]?.length > 0) {
      const blocks = sectionBlocksData[key].map(b =>
        b.type === 'text' ? { ...b, content: text || b.content || '' } : b
      );
      if (!blocks.some(b => b.type === 'text')) blocks.unshift({ type: 'text', content: text });
      result[key] = blocks;
      continue;
    }
    const imgs = sectionImagesData?.[key];
    let imageBlocks = [];
    if (Array.isArray(imgs) && imgs.length > 0) {
      imageBlocks = imgs[0]?.type === 'image' ? imgs : migrateImages(imgs);
    }
    result[key] = [{ type: 'text', content: text }, ...imageBlocks];
  }
  return result;
}

function pickSectionFields(obj) {
  const result = {};
  for (const key of SECTION_KEYS) {
    const val = obj?.[key];
    result[key] = typeof val === 'string' ? val : '';
  }
  return result;
}

export default function StructuredResult() {
  const { id } = useParams();
  const { state: navState } = useLocation();
  const { user } = useAuthStore();
  const [experience, setExperience] = useState(null);
  const [loading, setLoading] = useState(!navState?.analysis);
  const [saving, setSaving] = useState(false);
  const [sectionBlocks, setSectionBlocks] = useState({}); // { [key]: Block[] }
  const [editingSections, setEditingSections] = useState({});
  const [uploadingSection, setUploadingSection] = useState(null);
  const [draggingBlock, setDraggingBlock] = useState(null); // { sectionKey, fromIdx }
  const [dragOverBlock, setDragOverBlock] = useState(null); // { sectionKey, toIdx }
  const fileInputRefs = useRef({});

  useEffect(() => {
    if (navState?.analysis) {
      const structured = navState.analysis;
      setExperience({
        id,
        title: navState.title,
        framework: navState.framework,
        content: navState.content,
        structuredResult: structured,
        keywords: structured.keywords || [],
      });
      setSectionBlocks(buildSectionBlocks(structured, navState.sectionImages || {}, navState.sectionBlocks || {}));
    } else {
      loadExperience();
    }
  }, [id]);

  const loadExperience = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'experiences', id));
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setExperience(data);
        setSectionBlocks(buildSectionBlocks(
          data.structuredResult || data.content || {},
          data.sectionImages || {},
          data.sectionBlocks || {}
        ));
      }
    } catch (error) {
      console.error('경험 로딩 실패:', error);
    }
    setLoading(false);
  };

  const handleTextChange = (key, value) => {
    setSectionBlocks(prev => ({
      ...prev,
      [key]: (prev[key] || []).map(b => b.type === 'text' ? { ...b, content: value } : b),
    }));
  };

  const toggleEditing = (key) => {
    setEditingSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleImageUpload = async (sectionKey, files) => {
    if (!files?.length) return;
    const imgBlocks = (sectionBlocks[sectionKey] || []).filter(b => b.type === 'image');
    if (imgBlocks.length + files.length > 3) {
      toast.error('섯션당 사진은 최대 3장까지입니다');
      return;
    }
    setUploadingSection(sectionKey);
    for (const file of files) {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name}은(는) 이미지 파일이 아닙니다`); continue; }
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name}의 크기가 10MB를 초과합니다`); continue; }
      try {
        const base64 = await compressImage(file);
        const newBlock = { type: 'image', url: base64, name: file.name, width: 50, align: 'center' };
        setSectionBlocks(prev => ({ ...prev, [sectionKey]: [...(prev[sectionKey] || []), newBlock] }));
      } catch (err) {
        console.error('이미지 변환 실패:', err);
        toast.error(`${file.name} 처리에 실패했습니다`);
      }
    }
    setUploadingSection(null);
  };

  const handleBlockDelete = (sectionKey, idx) => {
    setSectionBlocks(prev => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] || []).filter((_, i) => i !== idx),
    }));
  };

  const handleBlockUpdate = (sectionKey, idx, updates) => {
    setSectionBlocks(prev => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] || []).map((b, i) => i === idx ? { ...b, ...updates } : b),
    }));
  };

  const handleBlockReorder = useCallback((sectionKey, fromIdx, toIdx) => {
    setSectionBlocks(prev => {
      const arr = [...(prev[sectionKey] || [])];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { ...prev, [sectionKey]: arr };
    });
  }, []);

  // 섯션 간 이미지 블록 이동
  const handleBlockMove = useCallback((fromSectionKey, fromIdx, toSectionKey, toIdx) => {
    setSectionBlocks(prev => {
      const srcArr = [...(prev[fromSectionKey] || [])];
      const dstArr = fromSectionKey === toSectionKey ? srcArr : [...(prev[toSectionKey] || [])];
      const [moved] = srcArr.splice(fromIdx, 1);
      // 이미지 블록만 이동 가능 (텍스트 블록은 이동 불가)
      if (moved.type !== 'image') return prev;
      // 대상 섯션의 이미지 최대 3장 체크
      const dstImgCount = dstArr.filter(b => b.type === 'image').length;
      if (dstImgCount >= 3) {
        toast.error('해당 섯션의 사진이 이미 3장입니다');
        return prev;
      }
      const insertIdx = Math.min(toIdx, dstArr.length);
      dstArr.splice(insertIdx, 0, moved);
      if (fromSectionKey === toSectionKey) {
        return { ...prev, [fromSectionKey]: dstArr };
      }
      return { ...prev, [fromSectionKey]: srcArr, [toSectionKey]: dstArr };
    });
  }, []);

  // 파일 드래그 드롭 핸들러 (파일 입력 전용)
  const handleDrop = (sectionKey, e) => {
    if (e.dataTransfer.types.includes('application/x-block')) return; // 블록 드래그는 내부에서 처리
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) handleImageUpload(sectionKey, files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ref = doc(db, 'experiences', id);
      const textContent = {};
      const savedSectionImages = {};
      for (const key of SECTION_KEYS) {
        const blocks = sectionBlocks[key] || [];
        textContent[key] = blocks.find(b => b.type === 'text')?.content || '';
        savedSectionImages[key] = blocks.filter(b => b.type === 'image');
      }
      const updatedStructured = { ...(experience.structuredResult || {}), ...textContent };
      await updateDoc(ref, {
        structuredResult: updatedStructured,
        content: textContent,
        sectionBlocks,
        sectionImages: savedSectionImages,
        updatedAt: new Date(),
      });
      setExperience(prev => ({ ...prev, structuredResult: updatedStructured }));
      toast.success('저장되었습니다');
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!experience) {
    return <p className="text-gray-500 text-center py-20">경험 데이터를 찾을 수 없습니다.</p>;
  }

  const structured = experience.structuredResult || {};
  const imageTips = structured.imageTips || {};
  const followUpQuestions = structured.followUpQuestions || [];
  const coachQuestions = structured.coachQuestions || [];
  const keywords = structured.keywords || experience.keywords || [];
  const highlights = structured.highlights || [];
  const inferredRole = structured.inferredRole || '';
  const othersText = structured.others || '';
  const sectionLabels = getSectionLabels(structured);

  return (
    <div className="animate-fadeIn max-w-5xl mx-auto">
      <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={16} /> 경험 목록으로
      </Link>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">경험 구조화 결과</h1>
        {inferredRole && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-50 border border-primary-200 rounded-full text-sm font-semibold text-primary-700 mb-3">
            <Sparkles size={14} />
            {inferredRole} 맞춤형 구조화
          </div>
        )}
        <p className="text-gray-400 mb-4">AI가 직무에 맞게 정리한 결과를 확인하고 수정하세요.</p>

        {/* Legend */}
        {highlights.length > 0 && (
          <div className="flex items-center justify-center gap-6 mt-2">
            {Object.entries(highlightColors).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2 text-sm text-gray-500">
                <span className={`w-3 h-3 rounded-full ${color.dot}`} />
                {color.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: 7 Sections */}
        <div className="col-span-2 space-y-4">
          {/* Keywords */}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {keywords.map(k => (
                <span key={k} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium border border-primary-200">
                  {k}
                </span>
              ))}
            </div>
          )}

          {SECTION_KEYS.map(key => {
            const blocks = sectionBlocks[key] || [];
            const textBlock = blocks.find(b => b.type === 'text');
            const textContent = textBlock?.content || '';
            const isEmpty = !textContent.trim();
            const isEditing = editingSections[key] || isEmpty;
            const tip = imageTips[key];
            const sectionHighlights = highlights.filter(h => h.field === key);
            const sectionLabel = sectionLabels[key];
            const imgBlocks = blocks.filter(b => b.type === 'image');

            return (
              <div
                key={key}
                className={`rounded-2xl border p-5 ${SECTION_COLORS[key]} ${
                  dragOverBlock?.sectionKey === key && dragOverBlock?.toIdx === -1 ? 'ring-2 ring-primary-400' : ''
                }`}
                onDrop={(e) => {
                  // 블록 드래그: 섯션 맨 끝에 추가
                  if (e.dataTransfer.types.includes('application/x-block')) {
                    const raw = e.dataTransfer.getData('application/x-block');
                    if (!raw) return;
                    e.preventDefault(); e.stopPropagation();
                    const { sectionKey: srcKey, fromIdx } = JSON.parse(raw);
                    const dstBlocks = sectionBlocks[key] || [];
                    handleBlockMove(srcKey, fromIdx, key, dstBlocks.length);
                    setDraggingBlock(null); setDragOverBlock(null);
                    return;
                  }
                  handleDrop(key, e);
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/x-block')) {
                    e.preventDefault();
                    // 블록 위에서 이미 isDragTarget 처리진 경우 섯션 진체는 무시
                  } else {
                    handleDragOver(e);
                  }
                }}
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    {sectionLabel}
                    {isEmpty && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-md text-[10px] font-semibold">
                        작성 필요
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    {key !== 'projectName' && key !== 'period' && (
                      <button
                        onClick={() => fileInputRefs.current[key]?.click()}
                        disabled={uploadingSection === key || imgBlocks.length >= 3}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-primary-600 hover:bg-white/60 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {uploadingSection === key ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                        사진
                      </button>
                    )}
                    <input
                      ref={el => fileInputRefs.current[key] = el}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={e => { handleImageUpload(key, Array.from(e.target.files)); e.target.value = ''; }}
                    />
                    {!isEmpty && (
                      <button onClick={() => toggleEditing(key)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                        {isEditing ? '완료' : '수정'}
                      </button>
                    )}
                  </div>
                </div>

                {/* 통합 블록 리스트: 텍스트 블록과 이미지 블록이 같은 리스트에 있어 드래그로 순서 변경 가능 */}
                <div className="space-y-1">
                  {blocks.map((block, idx) => {
                    const isBeingDragged = draggingBlock?.sectionKey === key && draggingBlock?.fromIdx === idx;
                    const isDragTarget = dragOverBlock?.sectionKey === key && dragOverBlock?.toIdx === idx;

                    const dropHandlers = {
                      onDragOver: (e) => {
                        if (!e.dataTransfer.types.includes('application/x-block')) return;
                        e.preventDefault(); e.stopPropagation();
                        if (!isDragTarget) setDragOverBlock({ sectionKey: key, toIdx: idx });
                      },
                      onDragLeave: (e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) setDragOverBlock(null);
                      },
                      onDrop: (e) => {
                        const raw = e.dataTransfer.getData('application/x-block');
                        if (!raw) return;
                        e.preventDefault(); e.stopPropagation();
                        const { sectionKey: srcKey, fromIdx } = JSON.parse(raw);
                        if (srcKey === key && fromIdx !== idx) {
                          handleBlockReorder(key, fromIdx, idx);
                        } else if (srcKey !== key) {
                          handleBlockMove(srcKey, fromIdx, key, idx);
                        }
                        setDraggingBlock(null); setDragOverBlock(null);
                      },
                    };

                    if (block.type === 'text') {
                      return (
                        <div
                          key={idx}
                          className={`rounded-lg transition-all ${
                            isDragTarget ? 'ring-2 ring-primary-400 ring-offset-1 bg-primary-50/40' : ''
                          }`}
                          {...dropHandlers}
                        >
                          {isEditing ? (
                            <textarea
                              value={block.content}
                              onChange={e => handleTextChange(key, e.target.value)}
                              placeholder={FRAMEWORKS.STRUCTURED.fields.find(f => f.key === key)?.placeholder || '내용을 입력하세요'}
                              rows={key === 'period' || key === 'projectName' ? 1 : 4}
                              className="w-full bg-white/70 rounded-xl border border-white/50 p-3 text-sm outline-none focus:ring-2 focus:ring-primary-200 transition-shadow resize-y"
                            />
                          ) : (
                            <div className="text-sm text-gray-700 leading-relaxed py-1">
                              <HighlightedText text={block.content} highlights={sectionHighlights} />
                            </div>
                          )}
                        </div>
                      );
                    }

                    // image block
                    return (
                      <div
                        key={idx}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/x-block', JSON.stringify({ sectionKey: key, fromIdx: idx }));
                          e.dataTransfer.effectAllowed = 'move';
                          e.stopPropagation();
                          requestAnimationFrame(() => setDraggingBlock({ sectionKey: key, fromIdx: idx }));
                        }}
                        onDragEnd={() => { setDraggingBlock(null); setDragOverBlock(null); }}
                        {...dropHandlers}
                        className={`transition-all duration-150 rounded-xl ${
                          isBeingDragged ? 'opacity-40 scale-[0.98]' : ''
                        } ${
                          isDragTarget && !isBeingDragged ? 'ring-2 ring-primary-400 ring-offset-1' : ''
                        }`}
                      >
                        <InlineImageBlock
                          block={block}
                          index={idx}
                          total={blocks.length}
                          onUpdate={(updates) => handleBlockUpdate(key, idx, updates)}
                          onDelete={() => handleBlockDelete(key, idx)}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* 드롭존 (이미지 없을 때) */}
                {key !== 'projectName' && key !== 'period' && imgBlocks.length === 0 && (
                  <div
                    className="mt-1 border border-dashed border-gray-300/60 rounded-lg p-2 text-center cursor-pointer hover:border-primary-300 hover:bg-white/30 transition-all"
                    onClick={() => fileInputRefs.current[key]?.click()}
                  >
                    <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
                      <ImagePlus size={11} />
                      사진 추가 — 텍스트 위아래 어디든 드래그로 배치 가능
                    </p>
                    {tip && <p className="text-[10px] text-gray-300 mt-0.5">💡 {tip}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* 역량 키워드 */}
          <div className="bg-white rounded-2xl border border-surface-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-primary-600" />
              <h3 className="font-bold">추출된 역량 키워드</h3>
            </div>
            {keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {keywords.map(k => (
                  <span key={k} className="px-4 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-medium border border-primary-200">
                    {k}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">AI 분석 후 표시됩니다</p>
            )}
          </div>

          {/* 코치 꼬리질문 */}
          {coachQuestions.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle size={18} className="text-amber-500" />
                <h3 className="font-bold text-amber-700">💡 완벽한 포트폴리오를 위한 코치의 꼬리질문</h3>
              </div>
              <div className="space-y-3">
                {coachQuestions.map((q, i) => (
                  <div key={i} className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-sm text-gray-700">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 기타 활동 및 성장 지표 */}
          {othersText && (
            <div className="bg-white rounded-2xl border border-surface-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-green-500" />
                <h3 className="font-bold">🌱 기타 활동 및 성장 지표</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{othersText}</p>
            </div>
          )}

          {/* 후속 질문 */}
          {followUpQuestions.length > 0 && (
            <div className="bg-white rounded-2xl border border-surface-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle size={18} className="text-gray-400" />
                <h3 className="font-bold">내용 보강 질문</h3>
              </div>
              <div className="space-y-3">
                {followUpQuestions.map((q, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-sm text-gray-600">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? '저장 중...' : '수정사항 저장'}
            </button>
            <Link
              to={`/app/experience/edit/${id}`}
              className="w-full py-3 text-center text-sm border border-surface-200 rounded-xl hover:bg-surface-50 transition-colors"
            >
              편집으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// === 용어 정의 ===
function migrateImages_all(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!Array.isArray(v)) { result[k] = []; continue; }
    // 이미 새 형식이면 그대로
    if (v.length === 0 || v[0]?.type === 'image') { result[k] = v; continue; }
    result[k] = migrateImages(v);
  }
  return result;
}

// === 인라인 이미지 블록 컴포넌트 ===
// 텍스트 흐름 안에 배치되며, 크기(너비 %)와 정렬, 순서 조절 가능
function InlineImageBlock({ block, index, total, onUpdate, onDelete, onMoveUp, onMoveDown }) {
  const widthOptions = [25, 50, 75, 100];
  const alignClass = {
    left: 'mr-auto',
    center: 'mx-auto',
    right: 'ml-auto',
  };

  return (
    <div className="group relative rounded-xl overflow-hidden bg-white/40 border border-white/60 p-2">
      {/* 컨트롤 툴바 */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {/* 드래그 핸들 */}
        <div
          className="cursor-grab active:cursor-grabbing p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
          title="드래그하여 순서 변경"
        >
          <GripVertical size={13} />
        </div>

        <div className="w-px h-4 bg-gray-200" />

        {/* 너비 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400">너비</span>
          {widthOptions.map(w => (
            <button
              key={w}
              onClick={() => onUpdate({ width: w })}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                block.width === w
                  ? 'bg-primary-500 text-white'
                  : 'bg-white/70 text-gray-500 hover:bg-primary-100'
              }`}
            >
              {w}%
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-gray-200" />

        {/* 정렬 */}
        <div className="flex items-center gap-0.5">
          {[['left', <AlignLeft size={10}/>], ['center', <AlignCenter size={10}/>], ['right', <AlignRight size={10}/>]].map(([a, icon]) => (
            <button
              key={a}
              onClick={() => onUpdate({ align: a })}
              className={`p-1 rounded transition-colors ${
                block.align === a
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
              title={a === 'left' ? '왼쪽 정렬' : a === 'center' ? '가운데 정렬' : '오른쪽 정렬'}
            >
              {icon}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* 삭제 */}
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
          title="사진 삭제"
        >
          <X size={12} />
        </button>
      </div>

      {/* 이미지 */}
      <div className="w-full">
        <img
          src={block.url}
          alt={block.name}
          draggable={false}
          className={`h-auto rounded-lg block ${alignClass[block.align] || 'mx-auto'}`}
          style={{ width: `${block.width || 50}%` }}
        />
      </div>

      {/* 파일명 */}
      <p className="text-[9px] text-gray-400 text-center mt-1 truncate">{block.name}</p>
    </div>
  );
}

// === 하이라이팅 유틸리티 (AnalysisResult에서 이식) ===

function fuzzyIndexOf(text, needle) {
  const exact = text.indexOf(needle);
  if (exact >= 0) return { pos: exact, len: needle.length };

  const normalize = s => s.replace(/\s+/g, ' ').trim();
  const normText = normalize(text);
  const normNeedle = normalize(needle);
  if (!normNeedle) return null;

  const normPos = normText.indexOf(normNeedle);
  if (normPos < 0) {
    const shorter = normNeedle.length > 15 ? normNeedle.slice(0, Math.floor(normNeedle.length * 0.7)) : null;
    if (shorter) {
      const partialPos = normText.indexOf(shorter);
      if (partialPos >= 0) {
        let origPos = 0, normIdx = 0;
        while (normIdx < partialPos && origPos < text.length) {
          if (/\s/.test(text[origPos])) { while (origPos < text.length && /\s/.test(text[origPos])) origPos++; normIdx++; }
          else { origPos++; normIdx++; }
        }
        let endNormIdx = normIdx, endOrigPos = origPos;
        while (endNormIdx < partialPos + normNeedle.length && endOrigPos < text.length) {
          if (/\s/.test(text[endOrigPos])) { while (endOrigPos < text.length && /\s/.test(text[endOrigPos])) endOrigPos++; endNormIdx++; }
          else { endOrigPos++; endNormIdx++; }
        }
        return { pos: origPos, len: endOrigPos - origPos };
      }
    }
    return null;
  }

  let origPos = 0, normIdx = 0;
  while (normIdx < normPos && origPos < text.length) {
    if (/\s/.test(text[origPos])) { while (origPos < text.length && /\s/.test(text[origPos])) origPos++; normIdx++; }
    else { origPos++; normIdx++; }
  }
  let endOrigPos = origPos, endNormIdx = normIdx;
  while (endNormIdx < normPos + normNeedle.length && endOrigPos < text.length) {
    if (/\s/.test(text[endOrigPos])) { while (endOrigPos < text.length && /\s/.test(text[endOrigPos])) endOrigPos++; endNormIdx++; }
    else { endOrigPos++; endNormIdx++; }
  }
  return { pos: origPos, len: endOrigPos - origPos };
}

function HighlightSpan({ text, type, keywords }) {
  const [visible, setVisible] = useState(false);
  const color = highlightColors[type] || highlightColors.core;

  return (
    <span
      className="relative inline"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className={`highlight-${type} cursor-help`}>{text}</span>
      {visible && keywords.length > 0 && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl pointer-events-none flex flex-col gap-1.5 min-w-max">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
            {color.label}
          </span>
          <span className="flex flex-wrap gap-1">
            {keywords.map(k => (
              <span key={k} className="px-1.5 py-0.5 bg-white/20 rounded-md text-[10px] leading-tight">{k}</span>
            ))}
          </span>
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

function HighlightedText({ text, highlights }) {
  if (!highlights || highlights.length === 0) {
    return <p className="whitespace-pre-wrap">{text}</p>;
  }

  const positioned = highlights
    .map(h => {
      const needle = h.text?.trim() ?? '';
      if (!needle) return null;
      if (h.start != null) return { ...h, pos: h.start, len: needle.length };
      const match = fuzzyIndexOf(text, needle);
      if (!match) return null;
      return { ...h, pos: match.pos, len: match.len };
    })
    .filter(Boolean)
    .sort((a, b) => a.pos - b.pos);

  if (positioned.length === 0) {
    return <p className="whitespace-pre-wrap">{text}</p>;
  }

  const parts = [];
  let lastIndex = 0;
  for (const h of positioned) {
    if (h.pos < lastIndex) continue;
    if (h.pos > lastIndex) parts.push({ text: text.slice(lastIndex, h.pos), type: null, keywords: [] });
    parts.push({ text: text.slice(h.pos, h.pos + h.len), type: h.type || 'core', keywords: h.keywords || [] });
    lastIndex = h.pos + h.len;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), type: null, keywords: [] });

  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.type ? (
          <HighlightSpan key={i} text={part.text} type={part.type} keywords={part.keywords} />
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </p>
  );
}
