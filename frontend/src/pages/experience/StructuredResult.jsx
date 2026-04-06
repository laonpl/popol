import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, Save, Loader2, HelpCircle, ImagePlus, X, Image, GripVertical } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FRAMEWORKS } from '../../stores/experienceStore';
import useAuthStore from '../../stores/authStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

const SECTION_KEYS = ['projectName', 'period', 'reason', 'solution', 'solutionReason', 'skills', 'result'];

const SECTION_LABELS = {
  projectName: '프로젝트명',
  period: '기간',
  reason: '선정이유',
  solution: '솔루션',
  solutionReason: '솔루션 채택 이유',
  skills: '사용된 역량',
  result: '결과',
};

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
  const [editedContent, setEditedContent] = useState({});
  const [editingSections, setEditingSections] = useState({});
  const [sectionImages, setSectionImages] = useState({}); // { sectionKey: [{ url, storagePath, name }] }
  const [uploadingSection, setUploadingSection] = useState(null);
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
      setEditedContent(pickSectionFields(structured));
      setSectionImages(navState.sectionImages || {});
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
        setEditedContent(pickSectionFields(data.structuredResult || data.content || {}));
        setSectionImages(data.sectionImages || {});
      }
    } catch (error) {
      console.error('경험 로딩 실패:', error);
    }
    setLoading(false);
  };

  const handleFieldChange = (key, value) => {
    setEditedContent(prev => ({ ...prev, [key]: value }));
  };

  const toggleEditing = (key) => {
    setEditingSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 섹션별 이미지 업로드
  const handleSectionImageUpload = async (sectionKey, files) => {
    if (!files?.length) return;
    const currentImages = sectionImages[sectionKey] || [];
    if (currentImages.length + files.length > 3) {
      toast.error('섹션당 사진은 최대 3장까지입니다');
      return;
    }

    setUploadingSection(sectionKey);
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}은(는) 이미지 파일이 아닙니다`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}의 크기가 5MB를 초과합니다`);
        continue;
      }

      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `experiences/${user.uid}/${id}/${sectionKey}/${timestamp}_${safeName}`;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('storagePath', storagePath);

        const { data } = await api.post('/upload/image', formData, { timeout: 60000 });
        const newImage = { url: data.url, storagePath: data.storagePath, name: file.name };

        setSectionImages(prev => ({
          ...prev,
          [sectionKey]: [...(prev[sectionKey] || []), newImage],
        }));
      } catch (err) {
        console.error('이미지 업로드 실패:', err);
        toast.error(`${file.name} 업로드에 실패했습니다`);
      }
    }
    setUploadingSection(null);
  };

  const handleSectionImageDelete = async (sectionKey, index) => {
    const target = (sectionImages[sectionKey] || [])[index];
    const updated = (sectionImages[sectionKey] || []).filter((_, i) => i !== index);
    setSectionImages(prev => ({ ...prev, [sectionKey]: updated }));

    try {
      await api.delete('/upload/image', { data: { storagePath: target.storagePath } });
    } catch (err) {
      console.warn('Storage 파일 삭제 실패 (무시됨):', err.message);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDrop = (sectionKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) handleSectionImageUpload(sectionKey, files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ref = doc(db, 'experiences', id);
      const updatedStructured = {
        ...(experience.structuredResult || {}),
        ...editedContent,
      };
      await updateDoc(ref, {
        structuredResult: updatedStructured,
        content: editedContent,
        sectionImages,
        updatedAt: new Date(),
      });
      setExperience(prev => ({ ...prev, structuredResult: updatedStructured, content: editedContent }));
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
  const keywords = structured.keywords || experience.keywords || [];
  const highlights = structured.highlights || [];

  return (
    <div className="animate-fadeIn max-w-5xl mx-auto">
      <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={16} /> 경험 목록으로
      </Link>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">경험 구조화 결과</h1>
        <p className="text-gray-400 mb-4">AI가 7가지 섹션으로 정리한 결과를 확인하고 수정하세요.</p>

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
            const value = editedContent[key] || '';
            const isEmpty = !value.trim();
            const isEditing = editingSections[key] || isEmpty;
            const tip = imageTips[key];
            const sectionHighlights = highlights.filter(h => h.field === key);
            const images = sectionImages[key] || [];

            return (
              <div
                key={key}
                className={`rounded-2xl border p-5 ${SECTION_COLORS[key]}`}
                onDrop={(e) => handleDrop(key, e)}
                onDragOver={handleDragOver}
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    {SECTION_LABELS[key]}
                    {isEmpty && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-md text-[10px] font-semibold">
                        작성 필요
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    {/* 이미지 추가 버튼 */}
                    {key !== 'projectName' && key !== 'period' && (
                      <button
                        onClick={() => fileInputRefs.current[key]?.click()}
                        disabled={uploadingSection === key || images.length >= 3}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-primary-600 hover:bg-white/60 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {uploadingSection === key ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ImagePlus size={12} />
                        )}
                        사진
                      </button>
                    )}
                    <input
                      ref={el => fileInputRefs.current[key] = el}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={e => {
                        handleSectionImageUpload(key, Array.from(e.target.files));
                        e.target.value = '';
                      }}
                    />
                    {!isEmpty && (
                      <button
                        onClick={() => toggleEditing(key)}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {isEditing ? '완료' : '수정'}
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <textarea
                    value={value}
                    onChange={e => handleFieldChange(key, e.target.value)}
                    placeholder={FRAMEWORKS.STRUCTURED.fields.find(f => f.key === key)?.placeholder || '내용을 입력하세요'}
                    rows={key === 'period' || key === 'projectName' ? 1 : 4}
                    className="w-full bg-white/70 rounded-xl border border-white/50 p-3 text-sm outline-none focus:ring-2 focus:ring-primary-200 transition-shadow resize-y"
                  />
                ) : (
                  <div className="text-sm text-gray-700 leading-relaxed">
                    <HighlightedText text={value} highlights={sectionHighlights} />
                  </div>
                )}

                {/* 섹션 이미지 갤러리 */}
                {images.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-white/60">
                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <button
                            onClick={() => handleSectionImageDelete(key, idx)}
                            className="opacity-0 group-hover:opacity-100 p-1 bg-white/90 rounded-full text-red-500 hover:bg-white transition-all"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <p className="absolute bottom-0 inset-x-0 px-1 py-0.5 bg-black/40 text-white text-[8px] truncate">
                          {img.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 드래그 영역 힌트 + 이미지 팁 */}
                {key !== 'projectName' && key !== 'period' && images.length === 0 && (
                  <div
                    className="mt-2 border border-dashed border-gray-300/60 rounded-lg p-2 text-center cursor-pointer hover:border-primary-300 hover:bg-white/30 transition-all"
                    onClick={() => fileInputRefs.current[key]?.click()}
                  >
                    <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
                      <ImagePlus size={11} />
                      사진을 드래그하거나 클릭하여 추가
                    </p>
                    {tip && (
                      <p className="text-[10px] text-gray-300 mt-0.5 flex items-center justify-center gap-1">
                        <Image size={10} />
                        💡 {tip}
                      </p>
                    )}
                  </div>
                )}

                {/* 이미지가 있을 때도 팁 표시 */}
                {images.length > 0 && tip && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-gray-400">
                    <Image size={12} className="mt-0.5 flex-shrink-0" />
                    <span>💡 {tip}</span>
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

          {/* 후속 질문 */}
          {followUpQuestions.length > 0 && (
            <div className="bg-white rounded-2xl border border-surface-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle size={18} className="text-amber-500" />
                <h3 className="font-bold">내용 보강 질문</h3>
              </div>
              <div className="space-y-3">
                {followUpQuestions.map((q, i) => (
                  <div key={i} className="p-3 bg-amber-50 rounded-xl border border-amber-100">
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
