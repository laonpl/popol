import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Save, Loader2, HelpCircle, PenLine, Check, ChevronDown, ChevronUp, GripVertical, Image as ImageIcon, ImagePlus } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FRAMEWORKS } from '../../stores/experienceStore';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';

// 하이라이트 색상 매핑
const highlightColors = {
  core: { bg: 'bg-red-100', border: 'border-red-300', label: '핵심 역량', dot: 'bg-red-400' },
  derived: { bg: 'bg-amber-100', border: 'border-amber-300', label: '파생 역량', dot: 'bg-amber-400' },
  growth: { bg: 'bg-green-100', border: 'border-green-300', label: '성장 관점', dot: 'bg-green-400' },
};

const SECTION_KEYS = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];

const SECTION_META = {
  intro:      { num: '01', label: '프로젝트 소개', subtitle: '서비스 이름 or 프로젝트 특징 + 소개 한 줄', accent: 'primary' },
  overview:   { num: '02', label: '프로젝트 개요', subtitle: '배경과 목적', accent: 'indigo' },
  task:       { num: '03', label: '진행한 일', subtitle: '배경-문제-(핵심)-해결', accent: 'purple' },
  process:    { num: '04', label: '과정', subtitle: '나의 직접적인 액션 + 인사이트', accent: 'violet' },
  output:     { num: '05', label: '결과물', subtitle: '최종으로 진행한 내용 + 포인트', accent: 'pink' },
  growth:     { num: '06', label: '성장한 점', subtitle: '성과가 있는 경우: 성과 / 없는 경우: 배운 점', accent: 'amber' },
  competency: { num: '07', label: '나의 역량', subtitle: '입사 시 기여할 수 있는 부분', accent: 'caribbean' },
};

const ACCENT_STYLES = {
  primary:   { num: 'bg-primary-500 text-white', border: 'border-primary-200', bg: 'bg-primary-50/40', label: 'text-primary-700', ring: 'focus:ring-primary-200' },
  indigo:    { num: 'bg-indigo-500 text-white', border: 'border-indigo-200', bg: 'bg-indigo-50/40', label: 'text-indigo-700', ring: 'focus:ring-indigo-200' },
  purple:    { num: 'bg-purple-500 text-white', border: 'border-purple-200', bg: 'bg-purple-50/40', label: 'text-purple-700', ring: 'focus:ring-purple-200' },
  violet:    { num: 'bg-violet-500 text-white', border: 'border-violet-200', bg: 'bg-violet-50/40', label: 'text-violet-700', ring: 'focus:ring-violet-200' },
  pink:      { num: 'bg-pink-500 text-white', border: 'border-pink-200', bg: 'bg-pink-50/40', label: 'text-pink-700', ring: 'focus:ring-pink-200' },
  amber:     { num: 'bg-amber-500 text-white', border: 'border-amber-200', bg: 'bg-amber-50/40', label: 'text-amber-700', ring: 'focus:ring-amber-200' },
  caribbean: { num: 'bg-caribbean-500 text-white', border: 'border-caribbean-200', bg: 'bg-caribbean-50/40', label: 'text-caribbean-700', ring: 'focus:ring-caribbean-200' },
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
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [experience, setExperience] = useState(null);
  const [loading, setLoading] = useState(!navState?.analysis);
  const [saving, setSaving] = useState(false);
  const [editedContent, setEditedContent] = useState({});
  const [editingSections, setEditingSections] = useState({});
  const [expandedSections, setExpandedSections] = useState(() => {
    const all = {};
    SECTION_KEYS.forEach(k => { all[k] = true; });
    return all;
  });
  const [allImages, setAllImages] = useState([]);
  const [sectionImages, setSectionImages] = useState({});
  const [dragInfo, setDragInfo] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [imageConfig, setImageConfig] = useState({});
  const imageInputRef = useRef(null);

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
      const fields = pickSectionFields(structured);
      setEditedContent(fields);
      const autoEdit = {};
      SECTION_KEYS.forEach(k => {
        if (!fields[k]?.trim()) autoEdit[k] = true;
      });
      setEditingSections(autoEdit);
      // Load images from Firestore (navState doesn't include images)
      (async () => {
        try {
          const docSnap = await getDoc(doc(db, 'experiences', id));
          if (docSnap.exists()) {
            const data = docSnap.data();
            const imgs = data.images || [];
            setAllImages(imgs);
            setSectionImages(data.sectionImages || { _unassigned: imgs.map((_, i) => i) });
            setImageConfig(data.imageConfig || {});
          }
        } catch (err) {
          console.error('이미지 로딩 실패:', err);
        }
      })();
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
        const imgs = data.images || [];
        setAllImages(imgs);
        setSectionImages(data.sectionImages || { _unassigned: imgs.map((_, i) => i) });
        setImageConfig(data.imageConfig || {});
        const fields = pickSectionFields(data.structuredResult || data.content || {});
        setEditedContent(fields);
        const autoEdit = {};
        SECTION_KEYS.forEach(k => {
          if (!fields[k]?.trim()) autoEdit[k] = true;
        });
        setEditingSections(autoEdit);
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

  const toggleExpand = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Image drag-and-drop
  const handleDragStart = (e, fromSection, position) => {
    setDragInfo({ fromSection, position });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };

  const handleDragEnd = () => {
    setDragInfo(null);
    setDropTarget(null);
  };

  const handleSectionDrop = (e, toSection) => {
    e.preventDefault();
    if (!dragInfo) return;
    const { fromSection, position } = dragInfo;
    setSectionImages(prev => {
      const next = {};
      Object.keys(prev).forEach(k => { next[k] = [...(prev[k] || [])]; });
      if (!next[fromSection]) next[fromSection] = [];
      if (!next[toSection]) next[toSection] = [];
      const [moved] = next[fromSection].splice(position, 1);
      next[toSection].push(moved);
      return next;
    });
    handleDragEnd();
  };

  const handleImageDrop = (e, toSection, toPosition) => {
    e.preventDefault();
    if (!dragInfo) return;
    const { fromSection, position: fromPos } = dragInfo;
    setSectionImages(prev => {
      const next = {};
      Object.keys(prev).forEach(k => { next[k] = [...(prev[k] || [])]; });
      if (!next[fromSection]) next[fromSection] = [];
      if (!next[toSection]) next[toSection] = [];
      const [moved] = next[fromSection].splice(fromPos, 1);
      let insertAt = toPosition;
      if (fromSection === toSection && fromPos < toPosition) insertAt--;
      next[toSection].splice(insertAt, 0, moved);
      return next;
    });
    handleDragEnd();
  };

  // 이미지 → Base64 변환 (Canvas 리사이즈 + 압축)
  const resizeToBase64 = (file, maxPx = 1200, quality = 0.75) =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else { width = Math.round(width * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = url;
    });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (allImages.length + files.length > 10) {
      toast.error('사진은 최대 10장까지 업로드할 수 있습니다');
      e.target.value = '';
      return;
    }
    setUploadingImage(true);
    try {
      const newImgs = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} 크기 초과 (10MB)`); continue; }
        const base64 = await resizeToBase64(file);
        newImgs.push({ url: base64, name: file.name });
      }
      if (newImgs.length > 0) {
        const startIdx = allImages.length;
        const updatedAll = [...allImages, ...newImgs];
        setAllImages(updatedAll);
        const unassigned = [...(sectionImages._unassigned || []), ...newImgs.map((_, i) => startIdx + i)];
        setSectionImages(prev => ({ ...prev, _unassigned: unassigned }));
        // Firestore에 이미지 즉시 저장
        const ref = doc(db, 'experiences', id);
        await updateDoc(ref, { images: updatedAll, updatedAt: new Date() });
        toast.success(`${newImgs.length}장 업로드 완료`);
      }
    } catch (err) {
      toast.error('이미지 업로드 실패');
    }
    setUploadingImage(false);
    e.target.value = '';
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
        images: allImages,
        sectionImages,
        imageConfig,
        updatedAt: new Date(),
      });
      setExperience(prev => ({ ...prev, structuredResult: updatedStructured }));
      const newEditing = {};
      SECTION_KEYS.forEach(k => {
        if (!editedContent[k]?.trim()) newEditing[k] = true;
      });
      setEditingSections(newEditing);
      toast.success('저장되었습니다');
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
    setSaving(false);
  };

  const filledCount = SECTION_KEYS.filter(k => editedContent[k]?.trim()).length;
  const emptyCount = SECTION_KEYS.length - filledCount;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!experience) {
    return <p className="text-bluewood-400 text-center py-20">경험 데이터를 찾을 수 없습니다.</p>;
  }

  const structured = experience.structuredResult || {};
  const followUpQuestions = structured.followUpQuestions || [];
  const keywords = structured.keywords || experience.keywords || [];

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto pb-12">
      <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-bluewood-400 hover:text-bluewood-600 mb-6 transition-colors">
        <ArrowLeft size={16} /> 경험 목록으로
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <Sparkles size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-bluewood-900">경험 구조화 결과</h1>
            <p className="text-sm text-bluewood-400">AI가 입력된 자료를 기반으로 정리한 결과입니다. 절대 만들어내지 않았습니다.</p>
          </div>
        </div>

        {/* Progress + Keywords + Highlight toggle */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-100 rounded-lg text-sm">
            <span className="text-bluewood-500">작성</span>
            <span className="font-bold text-primary-600">{filledCount}</span>
            <span className="text-bluewood-300">/</span>
            <span className="text-bluewood-400">7</span>
            {emptyCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                빈칸 {emptyCount}개
              </span>
            )}
          </div>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map(k => (
                <span key={k} className="px-2.5 py-1 bg-primary-50 text-primary-600 rounded-lg text-xs font-medium border border-primary-100">
                  {k}
                </span>
              ))}
            </div>
          )}
          {(structured.highlights || []).length > 0 && (
            <button
              onClick={() => setShowHighlights(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showHighlights
                  ? 'bg-primary-50 text-primary-600 border-primary-200'
                  : 'bg-surface-50 text-bluewood-400 border-surface-200 hover:bg-surface-100'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} />
                {showHighlights ? '하이라이트 끄기' : '역량 하이라이트'}
              </span>
            </button>
          )}
        </div>
        {showHighlights && (
          <div className="flex items-center gap-4 mt-2">
            {Object.entries(highlightColors).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-bluewood-500">
                <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                {color.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: 7 Sections */}
        <div className="col-span-2 space-y-3">
          {SECTION_KEYS.map(key => {
            const meta = SECTION_META[key];
            const style = ACCENT_STYLES[meta.accent];
            const value = editedContent[key] || '';
            const isEmpty = !value.trim();
            const isEditing = editingSections[key];
            const isExpanded = expandedSections[key];
            const field = FRAMEWORKS.STRUCTURED.fields.find(f => f.key === key);

            return (
              <div
                key={key}
                className={`rounded-2xl border ${style.border} ${style.bg} overflow-hidden transition-all`}
              >
                {/* Section Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(key)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left"
                >
                  <span className={`flex-shrink-0 w-9 h-9 rounded-xl ${style.num} flex items-center justify-center text-sm font-bold`}>
                    {meta.num}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${style.label}`}>{meta.label}</span>
                      <span className="text-xs text-bluewood-300">|</span>
                      <span className="text-xs text-bluewood-400">{meta.subtitle}</span>
                    </div>
                    {!isExpanded && value.trim() && (
                      <p className="text-sm text-bluewood-500 truncate mt-0.5">{value.slice(0, 80)}...</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEmpty && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-md text-[10px] font-semibold">
                        빈칸
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-bluewood-300" /> : <ChevronDown size={16} className="text-bluewood-300" />}
                  </div>
                </button>

                {/* Section Body */}
                {isExpanded && (
                  <div className="px-5 pb-5">
                    {/* Section images - ABOVE text */}
                    <SectionImageGroup
                      sectionKey={key}
                      position="above"
                      sectionImages={sectionImages}
                      allImages={allImages}
                      imageConfig={imageConfig}
                      setImageConfig={setImageConfig}
                      dragInfo={dragInfo}
                      dropTarget={dropTarget}
                      setDropTarget={setDropTarget}
                      handleDragStart={handleDragStart}
                      handleDragEnd={handleDragEnd}
                      handleImageDrop={handleImageDrop}
                    />

                    {isEditing ? (
                      <div>
                        <textarea
                          value={value}
                          onChange={e => handleFieldChange(key, e.target.value)}
                          placeholder={field?.placeholder || '내용을 입력하세요'}
                          rows={key === 'intro' ? 2 : 5}
                          className={`w-full bg-white rounded-xl border border-surface-200 p-4 text-sm outline-none ${style.ring} focus:ring-2 transition-shadow resize-y text-bluewood-800 placeholder-bluewood-300`}
                        />
                        {!isEmpty && (
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => toggleEditing(key)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${style.label} hover:bg-white/80 transition-colors`}
                            >
                              <Check size={13} /> 완료
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="group relative">
                        <div className="text-sm text-bluewood-700 leading-relaxed whitespace-pre-wrap">
                          {showHighlights ? (
                            <HighlightedText
                              text={value}
                              highlights={(structured.highlights || []).filter(h => h.field === key)}
                            />
                          ) : (
                            <p>{value}</p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleEditing(key)}
                          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-2.5 py-1 text-xs text-bluewood-400 hover:text-primary-600 bg-white/80 rounded-lg border border-surface-200 transition-all"
                        >
                          <PenLine size={12} /> 수정
                        </button>
                      </div>
                    )}

                    {/* 빈칸 채우기 CTA for empty sections */}
                    {isEmpty && !isEditing && (
                      <button
                        onClick={() => toggleEditing(key)}
                        className={`w-full py-3 mt-1 border-2 border-dashed ${style.border} rounded-xl text-sm font-medium ${style.label} hover:bg-white/60 transition-colors flex items-center justify-center gap-2`}
                      >
                        <PenLine size={14} /> 빈칸 채우기
                      </button>
                    )}

                    {/* Section images - BELOW text */}
                    <SectionImageGroup
                      sectionKey={key}
                      position="below"
                      sectionImages={sectionImages}
                      allImages={allImages}
                      imageConfig={imageConfig}
                      setImageConfig={setImageConfig}
                      dragInfo={dragInfo}
                      dropTarget={dropTarget}
                      setDropTarget={setDropTarget}
                      handleDragStart={handleDragStart}
                      handleDragEnd={handleDragEnd}
                      handleImageDrop={handleImageDrop}
                    />

                    {/* Drop zone when dragging */}
                    {dragInfo && (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDropTarget(key); }}
                        onDragLeave={() => { if (dropTarget === key) setDropTarget(null); }}
                        onDrop={(e) => handleSectionDrop(e, key)}
                        className={`mt-2 py-3 border-2 border-dashed rounded-xl text-center text-xs font-medium transition-colors ${
                          dropTarget === key ? 'border-primary-400 bg-primary-50/60 text-primary-500' : 'border-surface-200 text-bluewood-300'
                        }`}
                      >
                        {dragInfo.fromSection === key ? '끝으로 이동' : '여기로 이미지 이동'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-card"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? '저장 중...' : '저장하기'}
          </button>

          {/* Unassigned images */}
          <div 
            className={`bg-white rounded-2xl border border-surface-200 p-5 transition-colors ${dragInfo && dropTarget === '_unassigned' ? 'ring-2 ring-primary-200' : ''}`}
            onDragOver={(e) => { if (dragInfo) { e.preventDefault(); setDropTarget('_unassigned'); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { if (dropTarget === '_unassigned') setDropTarget(null); } }}
            onDrop={(e) => handleSectionDrop(e, '_unassigned')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-bluewood-500" />
                <h3 className="font-bold text-sm text-bluewood-900">사진</h3>
              </div>
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200"
              >
                {uploadingImage ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                {uploadingImage ? '업로드중' : '추가'}
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            {allImages.length > 0 ? (
              <>
                <p className="text-xs text-bluewood-400 mb-2">드래그하여 섹션에 배치하세요</p>
                {(sectionImages._unassigned || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(sectionImages._unassigned || []).map((imgIdx, pos) => {
                      const img = allImages[imgIdx];
                      if (!img) return null;
                      return (
                        <div
                          key={`unassigned-${imgIdx}`}
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, '_unassigned', pos); }}
                          onDragEnd={handleDragEnd}
                          className="relative group cursor-grab active:cursor-grabbing"
                        >
                          <img src={img.url} alt={img.name || '이미지'} className="w-20 h-16 object-cover rounded-lg border border-surface-200 shadow-sm" />
                          <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 bg-black/50 rounded p-0.5 transition-opacity">
                            <GripVertical size={12} className="text-white" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`text-xs text-center py-3 rounded-xl transition-colors ${
                    dragInfo ? 'border-2 border-dashed border-surface-200 text-bluewood-400' : 'text-bluewood-300'
                  }`}>
                    {dragInfo ? '여기로 이미지 되돌리기' : '모든 이미지가 섹션에 배치됨'}
                  </p>
                )}
              </>
            ) : (
              <button
                onClick={() => imageInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-surface-200 rounded-xl text-xs text-bluewood-300 hover:border-primary-200 hover:text-primary-400 transition-colors"
              >
                사진을 추가하세요
              </button>
            )}
          </div>

          {/* 역량 키워드 */}
          {keywords.length > 0 && (
            <div className="bg-white rounded-2xl border border-surface-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-primary-600" />
                <h3 className="font-bold text-sm text-bluewood-900">추출된 역량 키워드</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {keywords.map(k => (
                  <span key={k} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-xl text-xs font-medium border border-primary-200">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 후속 질문 */}
          {followUpQuestions.length > 0 && (
            <div className="bg-white rounded-2xl border border-surface-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle size={16} className="text-amber-500" />
                <h3 className="font-bold text-sm text-bluewood-900">빈칸 채우기 힌트</h3>
              </div>
              <div className="space-y-2">
                {followUpQuestions.map((q, i) => (
                  <div key={i} className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <p className="text-xs text-bluewood-600 leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 작성 가이드 */}
          <div className="bg-white rounded-2xl border border-surface-200 p-5">
            <h3 className="font-bold text-sm text-bluewood-900 mb-3">작성 가이드</h3>
            <ul className="space-y-2 text-xs text-bluewood-500">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 flex-shrink-0" />
                AI는 입력된 내용만 정리합니다. 경험을 만들어내지 않습니다.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <strong>빈칸</strong>으로 표시된 섹션은 직접 채워주세요.
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-caribbean-400 mt-1.5 flex-shrink-0" />
                모든 섹션을 채우면 자소서, 포트폴리오에 바로 활용할 수 있습니다.
              </li>
            </ul>
          </div>

          <Link
            to="/app/experience"
            className="block w-full py-3 text-center text-sm border border-surface-200 rounded-xl hover:bg-surface-50 transition-colors text-bluewood-500"
          >
            경험 목록으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

// 공백 정규화 후 위치 찾기
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
  if (!highlights || highlights.length === 0) return <p>{text}</p>;

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

  if (positioned.length === 0) return <p>{text}</p>;

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
    <p>
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

const SIZE_OPTIONS = [
  { value: 'sm', label: 'S', w: 'max-w-[140px]' },
  { value: 'md', label: 'M', w: 'max-w-[280px]' },
  { value: 'lg', label: 'L', w: 'max-w-full' },
];

function SectionImageGroup({ sectionKey, position, sectionImages, allImages, imageConfig, setImageConfig, dragInfo, dropTarget, setDropTarget, handleDragStart, handleDragEnd, handleImageDrop }) {
  const imgIndices = sectionImages[sectionKey] || [];
  const filtered = imgIndices.map((imgIdx, pos) => ({ imgIdx, pos })).filter(({ imgIdx }) => {
    const cfg = imageConfig[`${sectionKey}:${imgIdx}`] || {};
    const imgPos = cfg.position || 'below';
    return imgPos === position;
  });
  if (filtered.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-3 ${position === 'above' ? 'mb-3' : 'mt-3'}`}>
      {filtered.map(({ imgIdx, pos }) => {
        const img = allImages[imgIdx];
        if (!img) return null;
        const cfgKey = `${sectionKey}:${imgIdx}`;
        const cfg = imageConfig[cfgKey] || {};
        const size = cfg.size || 'md';
        const sizeOpt = SIZE_OPTIONS.find(s => s.value === size) || SIZE_OPTIONS[1];

        const togglePosition = () => {
          setImageConfig(prev => ({
            ...prev,
            [cfgKey]: { ...(prev[cfgKey] || {}), position: position === 'above' ? 'below' : 'above' },
          }));
        };

        const cycleSize = () => {
          const idx = SIZE_OPTIONS.findIndex(s => s.value === size);
          const next = SIZE_OPTIONS[(idx + 1) % SIZE_OPTIONS.length];
          setImageConfig(prev => ({
            ...prev,
            [cfgKey]: { ...(prev[cfgKey] || {}), size: next.value },
          }));
        };

        return (
          <div
            key={`img-${sectionKey}-${imgIdx}-${position}`}
            className="relative"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropTarget(`${sectionKey}:${pos}`); }}
            onDrop={(e) => { e.stopPropagation(); handleImageDrop(e, sectionKey, pos); }}
          >
            {dropTarget === `${sectionKey}:${pos}` && dragInfo && !(dragInfo.fromSection === sectionKey && dragInfo.position === pos) && (
              <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-primary-400 rounded-full z-10" />
            )}
            <div
              draggable
              onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, sectionKey, pos); }}
              onDragEnd={handleDragEnd}
              className={`relative group cursor-grab active:cursor-grabbing ${sizeOpt.w}`}
            >
              <img src={img.url} alt={img.name || '이미지'} className={`w-full rounded-lg border border-surface-200 shadow-sm hover:shadow-md transition-shadow ${size === 'sm' ? 'h-24 object-cover' : ''}`} />
              {/* Overlay controls */}
              <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <div className="bg-black/60 rounded-md p-0.5">
                  <GripVertical size={14} className="text-white" />
                </div>
              </div>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); togglePosition(); }}
                  className="bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md hover:bg-black/80"
                  title={position === 'above' ? '글 아래로' : '글 위로'}
                >
                  {position === 'above' ? '↓' : '↑'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); cycleSize(); }}
                  className="bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md hover:bg-black/80"
                  title="크기 변경"
                >
                  {sizeOpt.label}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
