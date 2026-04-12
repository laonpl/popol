import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Save, Loader2, HelpCircle, PenLine, Check, ChevronDown, ChevronUp, GripVertical, Image as ImageIcon, ImagePlus, TrendingUp, Target, Users, Clock, Zap } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FRAMEWORKS } from '../../stores/experienceStore';
import useAuthStore from '../../stores/authStore';
import KeyExperienceSlider from '../../components/KeyExperienceSlider';
import { CHART_TYPES } from '../../components/KeyExperienceSlider';
import toast from 'react-hot-toast';

/* ── 마크다운 **bold** → <strong> 변환 + 불필요 마크다운 제거 ── */
function renderMarkdown(text) {
  if (!text) return '';
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  if (parts.length <= 1) return text.replace(/\*\*/g, '');
  return parts.map((seg, i) => {
    const m = seg.match(/^\*\*(.+)\*\*$/);
    if (m) return <strong key={i} className="font-bold">{m[1]}</strong>;
    return seg.replace(/\*\*/g, '');
  });
}
function stripMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/\*\*/g, '').replace(/^#+\s/gm, '').replace(/^[-*]\s/gm, '');
}

// 하이라이트 색상 매핑 (밑줄 스타일)
const highlightColors = {
  core: { underline: '#ef4444', bg: 'bg-red-50', label: '핵심 역량', dot: 'bg-red-400', text: 'text-red-700' },
  derived: { underline: '#f59e0b', bg: 'bg-amber-50', label: '파생 역량', dot: 'bg-amber-400', text: 'text-amber-700' },
  growth: { underline: '#22c55e', bg: 'bg-green-50', label: '성장 관점', dot: 'bg-green-400', text: 'text-green-700' },
};

const SECTION_KEYS = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];

const SECTION_META = {
  intro:      { num: '01', label: '프로젝트 소개', subtitle: '서비스 이름 or 프로젝트 특징 + 소개 한 줄', accent: 'primary' },
  overview:   { num: '02', label: '프로젝트 개요', subtitle: '배경과 목적', accent: 'primary' },
  task:       { num: '03', label: '진행한 일', subtitle: '배경-문제-(핵심)-해결', accent: 'primary' },
  process:    { num: '04', label: '과정', subtitle: '나의 직접적인 액션 + 인사이트', accent: 'primary' },
  output:     { num: '05', label: '결과물', subtitle: '최종으로 진행한 내용 + 포인트', accent: 'primary' },
  growth:     { num: '06', label: '성장한 점', subtitle: '성과가 있는 경우: 성과 / 없는 경우: 배운 점', accent: 'primary' },
  competency: { num: '07', label: '나의 역량', subtitle: '입사 시 기여할 수 있는 부분', accent: 'primary' },
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
  const [editedTitle, setEditedTitle] = useState('');
  const [editedOverview, setEditedOverview] = useState({ background: '', goal: '', role: '', team: '', duration: '', summary: '', techStack: [] });
  const [editedKeywords, setEditedKeywords] = useState([]);
  const [editedKeyExperiences, setEditedKeyExperiences] = useState([]);
  const [newTechInput, setNewTechInput] = useState('');
  const [newKeywordInput, setNewKeywordInput] = useState('');
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
  const [showHighlights, setShowHighlights] = useState(true);
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
      setEditedTitle(navState.title || '');
      setEditedOverview({
        background: structured.projectOverview?.background || '',
        goal: structured.projectOverview?.goal || '',
        role: structured.projectOverview?.role || '',
        team: structured.projectOverview?.team || '',
        duration: structured.projectOverview?.duration || '',
        summary: structured.projectOverview?.summary || '',
        techStack: structured.projectOverview?.techStack || [],
      });
      setEditedKeywords(structured.keywords || []);
      setEditedKeyExperiences((structured.keyExperiences || []).map(e => ({ ...e })));
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
        const sr = data.structuredResult || {};
        setEditedTitle(data.title || '');
        setEditedOverview({
          background: sr.projectOverview?.background || '',
          goal: sr.projectOverview?.goal || '',
          role: sr.projectOverview?.role || '',
          team: sr.projectOverview?.team || '',
          duration: sr.projectOverview?.duration || '',
          summary: sr.projectOverview?.summary || '',
          techStack: sr.projectOverview?.techStack || [],
        });
        setEditedKeywords(sr.keywords || data.keywords || []);
        setEditedKeyExperiences((sr.keyExperiences || []).map(e => ({ ...e })));
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
        projectOverview: { ...editedOverview },
        keywords: editedKeywords,
        keyExperiences: editedKeyExperiences,
      };
      await updateDoc(ref, {
        title: editedTitle,
        structuredResult: updatedStructured,
        keywords: editedKeywords,
        images: allImages,
        sectionImages,
        imageConfig,
        updatedAt: new Date(),
      });
      setExperience(prev => ({ ...prev, title: editedTitle, structuredResult: updatedStructured, keywords: editedKeywords }));
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

  /* 작성 완성도 % */
  const completionPct = Math.round((filledCount / 7) * 100);

  return (
    <div className="animate-fadeIn max-w-[1200px] mx-auto pb-12">
      {/* 상단 네비 + 저장 */}
      <div className="flex items-center justify-between mb-5">
        <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-bluewood-400 hover:text-bluewood-600 transition-colors">
          <ArrowLeft size={16} /> 경험 목록으로
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-card"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>

      {/* ╔══════════════════════════════════════════════╗
         ║  상단 대시보드: 좌 Overview + 우 핵심경험    ║
         ╚══════════════════════════════════════════════╝ */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 mb-5">

        {/* ── 좌: 프로젝트 Overview (편집 가능) ── */}
        <div className="bg-white rounded-2xl border border-surface-200 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-extrabold text-bluewood-900">Overview</h2>
          </div>

          {/* 프로젝트 타이틀 (편집) */}
          <input
            value={editedTitle}
            onChange={e => setEditedTitle(e.target.value)}
            className="text-lg font-bold text-bluewood-900 leading-snug mb-2 bg-transparent border-b border-transparent hover:border-surface-200 focus:border-primary-400 focus:outline-none transition-colors px-0 py-0.5 w-full"
            placeholder="프로젝트 제목"
          />

          {/* 배경/요약 (편집) */}
          <textarea
            value={editedOverview.background || editedOverview.summary || ''}
            onChange={e => setEditedOverview(prev => ({ ...prev, background: e.target.value }))}
            rows={3}
            className="text-[12.5px] text-bluewood-400 leading-relaxed mb-5 bg-transparent border border-transparent hover:border-surface-200 focus:border-primary-300 focus:outline-none rounded-lg p-1.5 resize-none transition-colors w-full"
            placeholder="프로젝트 배경 설명"
          />

          {/* 메타 항목 (편집) */}
          <div className="space-y-3 mb-5">
            {[
              { key: 'goal',     label: '목표',   placeholder: '프로젝트 목표' },
              { key: 'role',     label: '역할',   placeholder: '담당 역할' },
              { key: 'team',     label: '팀 구성', placeholder: '팀 인원 / 구성' },
              { key: 'duration', label: '기간',   placeholder: '2024.01 ~ 2024.06' },
            ].map((item, i) => (
              <div key={item.key} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 text-[12px] font-bold text-bluewood-300 mt-2">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-semibold text-bluewood-700">{item.label}</span>
                  <input
                    value={editedOverview[item.key] || ''}
                    onChange={e => setEditedOverview(prev => ({ ...prev, [item.key]: e.target.value }))}
                    className="w-full text-[12px] text-bluewood-500 leading-relaxed bg-transparent border-b border-transparent hover:border-surface-200 focus:border-primary-300 focus:outline-none transition-colors py-0.5"
                    placeholder={item.placeholder}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 기술 스택 (편집) */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(editedOverview.techStack || []).map((tech, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-100 text-bluewood-600 rounded-md text-[11px] font-medium group/tech">
                  {tech}
                  <button onClick={() => setEditedOverview(prev => ({ ...prev, techStack: prev.techStack.filter((_, j) => j !== i) }))}
                    className="text-bluewood-300 hover:text-red-500 transition-colors ml-0.5 text-[10px]">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={newTechInput}
                onChange={e => setNewTechInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newTechInput.trim()) {
                    e.preventDefault();
                    setEditedOverview(prev => ({ ...prev, techStack: [...(prev.techStack || []), newTechInput.trim()] }));
                    setNewTechInput('');
                  }
                }}
                className="flex-1 text-[11px] bg-surface-50 border border-surface-200 rounded-md px-2 py-1 focus:outline-none focus:border-primary-300 transition-colors"
                placeholder="기술 추가 후 Enter"
              />
            </div>
          </div>

          {/* 역량 키워드 (편집) */}
          <div className="mt-auto pt-4 border-t border-surface-100">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {editedKeywords.map((k, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-600 rounded-md text-[11px] font-medium border border-primary-100">
                  {k}
                  <button onClick={() => setEditedKeywords(prev => prev.filter((_, j) => j !== i))}
                    className="text-primary-300 hover:text-red-500 transition-colors ml-0.5 text-[10px]">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={newKeywordInput}
                onChange={e => setNewKeywordInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newKeywordInput.trim()) {
                    e.preventDefault();
                    setEditedKeywords(prev => [...prev, newKeywordInput.trim()]);
                    setNewKeywordInput('');
                  }
                }}
                className="flex-1 text-[11px] bg-surface-50 border border-surface-200 rounded-md px-2 py-1 focus:outline-none focus:border-primary-300 transition-colors"
                placeholder="키워드 추가 후 Enter"
              />
            </div>
          </div>
        </div>

        {/* ── 우: 핵심 경험 슬라이더 (편집 가능) ── */}
        <div className="min-w-0">
          <KeyExperienceSlider keyExperiences={editedKeyExperiences} />
          {/* 핵심 경험 편집 패널 */}
          <div className="mt-4 space-y-3">
            {editedKeyExperiences.map((exp, idx) => (
              <details key={idx} className="bg-white rounded-xl border border-surface-200 overflow-hidden group/detail">
                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-50 transition-colors select-none">
                  <span className="flex-shrink-0 w-6 h-6 rounded-md bg-primary-100 text-primary-700 flex items-center justify-center text-[11px] font-bold">{idx + 1}</span>
                  <span className="text-[13px] font-semibold text-bluewood-800 flex-1 min-w-0 truncate">{exp.title || `핵심 경험 ${idx + 1}`}</span>
                  <span className="text-[11px] text-primary-500 font-medium">{exp.metric || ''}</span>
                </summary>
                <div className="px-4 pb-4 pt-2 space-y-2.5 border-t border-surface-100">
                  {[
                    { key: 'title',        label: '제목',    placeholder: '핵심 경험 제목' },
                    { key: 'metric',       label: '성과 지표', placeholder: '예: 40% 단축' },
                    { key: 'metricLabel',  label: '지표 설명', placeholder: '예: API 응답 시간' },
                    { key: 'beforeMetric', label: '개선 전',  placeholder: '예: 평균 800ms' },
                    { key: 'afterMetric',  label: '개선 후',  placeholder: '예: 평균 480ms' },
                    { key: 'situation',    label: '문제 상황', placeholder: '어떤 문제가 있었나요?' },
                    { key: 'action',       label: '핵심 행동', placeholder: '어떤 행동을 했나요?' },
                    { key: 'result',       label: '결과',    placeholder: '어떤 결과를 얻었나요?' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="text-[11px] font-semibold text-bluewood-500 mb-0.5 block">{field.label}</label>
                      {['situation', 'action', 'result'].includes(field.key) ? (
                        <textarea
                          value={exp[field.key] || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setEditedKeyExperiences(prev => prev.map((item, i) => i === idx ? { ...item, [field.key]: val } : item));
                          }}
                          rows={2}
                          className="w-full text-[12px] text-bluewood-700 bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-300 resize-none transition-colors"
                          placeholder={field.placeholder}
                        />
                      ) : (
                        <input
                          value={exp[field.key] || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setEditedKeyExperiences(prev => prev.map((item, i) => i === idx ? { ...item, [field.key]: val } : item));
                          }}
                          className="w-full text-[12px] text-bluewood-700 bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-300 transition-colors"
                          placeholder={field.placeholder}
                        />
                      )}
                    </div>
                  ))}
                  {/* 차트 타입 선택 */}
                  <div>
                    <label className="text-[11px] font-semibold text-bluewood-500 mb-1.5 block">그래프 스타일</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {CHART_TYPES.map(ct => (
                        <button key={ct.id}
                          onClick={() => setEditedKeyExperiences(prev => prev.map((item, i) => i === idx ? { ...item, chartType: ct.id } : item))}
                          className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-center transition-all ${
                            (exp.chartType || 'horizontalBar') === ct.id
                              ? 'border-primary-400 bg-primary-50 text-primary-700 shadow-sm'
                              : 'border-surface-200 bg-white text-bluewood-400 hover:border-surface-300 hover:bg-surface-50'
                          }`}>
                          <span className="text-[14px] leading-none">{ct.icon}</span>
                          <span className="text-[9px] font-medium leading-tight">{ct.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setEditedKeyExperiences(prev => prev.filter((_, i) => i !== idx))}
                    className="text-[11px] text-red-400 hover:text-red-600 transition-colors mt-1">삭제</button>
                </div>
              </details>
            ))}
            <button onClick={() => setEditedKeyExperiences(prev => [...prev, { title: '', metric: '', metricLabel: '', beforeMetric: '', afterMetric: '', situation: '', action: '', result: '', keywords: [] }])}
              className="w-full py-2.5 border-2 border-dashed border-surface-200 rounded-xl text-[12px] font-medium text-bluewood-400 hover:border-primary-300 hover:text-primary-500 transition-colors">
              + 핵심 경험 추가
            </button>
          </div>
        </div>
      </div>

      {/* ╔══════════════════════════════════════════════╗
         ║  하단 좌: 작성 완성도 + 사진 / 우: 힌트     ║
         ╚══════════════════════════════════════════════╝ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* 작성 완성도 (Passing rate 스타일) */}
        <div className="bg-white rounded-2xl border border-surface-200 p-6">
          <h3 className="text-[14px] font-extrabold text-bluewood-900 mb-4">작성 완성도</h3>
          <div className="flex items-end gap-6">
            <div>
              <p className="text-[11px] text-caribbean-600 font-semibold mb-0.5">Complete</p>
              <p className="text-[28px] font-black text-bluewood-900 leading-none">{completionPct}%</p>
            </div>
            <div>
              <p className="text-[11px] text-red-400 font-semibold mb-0.5">빈칸</p>
              <p className="text-[28px] font-black text-bluewood-900 leading-none">{emptyCount}</p>
            </div>
            <div>
              <p className="text-[11px] text-bluewood-300 font-semibold mb-0.5">전체</p>
              <p className="text-[28px] font-black text-bluewood-900 leading-none">7</p>
            </div>
          </div>
          {/* 미니 바 */}
          <div className="flex gap-1 mt-4">
            {SECTION_KEYS.map(k => (
              <div key={k} className={`h-2 flex-1 rounded-full ${editedContent[k]?.trim() ? 'bg-caribbean-400' : 'bg-surface-200'}`} />
            ))}
          </div>
        </div>

        {/* 사진 */}
        <div 
          className={`bg-white rounded-2xl border border-surface-200 p-6 transition-colors ${dragInfo && dropTarget === '_unassigned' ? 'ring-2 ring-primary-200' : ''}`}
          onDragOver={(e) => { if (dragInfo) { e.preventDefault(); setDropTarget('_unassigned'); } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { if (dropTarget === '_unassigned') setDropTarget(null); } }}
          onDrop={(e) => handleSectionDrop(e, '_unassigned')}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-extrabold text-bluewood-900">사진</h3>
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200"
            >
              {uploadingImage ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
              {uploadingImage ? '업로드중' : '추가'}
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
          </div>
          {allImages.length > 0 ? (
            (sectionImages._unassigned || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(sectionImages._unassigned || []).map((imgIdx, pos) => {
                  const img = allImages[imgIdx];
                  if (!img) return null;
                  return (
                    <div key={`unassigned-${imgIdx}`} draggable
                      onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, '_unassigned', pos); }}
                      onDragEnd={handleDragEnd}
                      className="relative group cursor-grab active:cursor-grabbing">
                      <img src={img.url} alt={img.name || '이미지'} className="w-16 h-12 object-cover rounded-lg border border-surface-200" />
                      <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 bg-black/50 rounded p-0.5 transition-opacity">
                        <GripVertical size={10} className="text-white" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-bluewood-300 text-center py-3">모든 이미지 배치됨</p>
            )
          ) : (
            <button onClick={() => imageInputRef.current?.click()}
              className="w-full py-4 border-2 border-dashed border-surface-200 rounded-xl text-xs text-bluewood-300 hover:border-primary-200 hover:text-primary-400 transition-colors">
              사진을 추가하세요
            </button>
          )}
        </div>

        {/* 힌트 & 가이드 */}
        <div className="bg-white rounded-2xl border border-surface-200 p-6">
          <h3 className="text-[14px] font-extrabold text-bluewood-900 mb-3">작성 가이드</h3>
          <ul className="space-y-2.5 text-[12px] text-bluewood-500 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 flex-shrink-0" />
              AI는 입력된 내용만 정리합니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
              <strong>빈칸</strong> 섹션은 직접 채워주세요.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-caribbean-400 mt-1.5 flex-shrink-0" />
              모든 섹션 완성 시 자소서·포트폴리오에 활용 가능
            </li>
          </ul>
          {followUpQuestions.length > 0 && (
            <div className="mt-4 pt-3 border-t border-surface-100 space-y-2">
              <p className="text-[11px] font-bold text-amber-500">빈칸 채우기 힌트</p>
              {followUpQuestions.map((q, i) => (
                <p key={i} className="text-[11px] text-bluewood-500 leading-relaxed">{q}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ╔══════════════════════════════════════════════╗
         ║  하단: 상세 경험 정리 — 항상 펼쳐진 편집모드  ║
         ╚══════════════════════════════════════════════╝ */}
      <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-extrabold text-bluewood-900">상세 경험 정리</h2>
            <span className="text-[12px] text-bluewood-300 font-medium">{filledCount}/7 작성</span>
          </div>
          <div className="flex items-center gap-2">
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
        </div>

        {/* 하이라이트 범례 */}
        {showHighlights && (structured.highlights || []).length > 0 && (
          <div className="flex items-center gap-5 px-6 py-2.5 bg-surface-50/60 border-b border-surface-100">
            {Object.entries(highlightColors).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2 text-[11px] text-bluewood-500">
                <span className="inline-block w-5 h-0" style={{ borderBottom: `2.5px solid ${color.underline}` }} />
                {color.label}
              </div>
            ))}
          </div>
        )}

        {/* 섹션 본문 — 항상 펼쳐진 편집 모드 */}
        <div className="divide-y divide-surface-100">
          {SECTION_KEYS.map(key => {
            const meta = SECTION_META[key];
            const style = ACCENT_STYLES[meta.accent];
            const value = editedContent[key] || '';
            const isEmpty = !value.trim();
            const isEditing = editingSections[key];
            const field = FRAMEWORKS.STRUCTURED.fields.find(f => f.key === key);

            return (
              <div key={key} className="group">
                {/* 섹션 헤더 바 */}
                <div className="flex items-center gap-4 px-6 py-3 bg-surface-50/30">
                  <span className={`flex-shrink-0 w-7 h-7 rounded-lg ${style.num} flex items-center justify-center text-[11px] font-bold`}>
                    {meta.num}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[13px] font-bold ${style.label}`}>{meta.label}</span>
                    <span className="text-[11px] text-bluewood-300 ml-2">{meta.subtitle}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEmpty ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-[10px] font-semibold">빈칸</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-caribbean-50 text-caribbean-600 rounded text-[10px] font-semibold">완료</span>
                    )}
                    {!isEditing && !isEmpty && (
                      <button onClick={() => toggleEditing(key)}
                        className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-2 py-1 text-[11px] text-bluewood-400 hover:text-primary-600 bg-white rounded-md border border-surface-200 transition-all">
                        <PenLine size={11} /> 수정
                      </button>
                    )}
                  </div>
                </div>

                {/* 섹션 본문 — 항상 열림 */}
                <div className="px-6 py-4 pl-[60px]">
                  {/* 이미지 (위) */}
                  <SectionImageGroup sectionKey={key} position="above"
                    sectionImages={sectionImages} allImages={allImages} imageConfig={imageConfig} setImageConfig={setImageConfig}
                    dragInfo={dragInfo} dropTarget={dropTarget} setDropTarget={setDropTarget}
                    handleDragStart={handleDragStart} handleDragEnd={handleDragEnd} handleImageDrop={handleImageDrop} />

                  {isEditing ? (
                    <div>
                      <textarea
                        value={value}
                        onChange={e => handleFieldChange(key, e.target.value)}
                        placeholder={field?.placeholder || '내용을 입력하세요'}
                        rows={key === 'intro' ? 2 : 5}
                        className={`w-full bg-white rounded-xl border border-surface-200 p-4 text-[13px] outline-none ${style.ring} focus:ring-2 transition-shadow resize-y text-bluewood-800 placeholder-bluewood-300`}
                      />
                      {!isEmpty && (
                        <div className="flex justify-end mt-2">
                          <button onClick={() => toggleEditing(key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${style.label} hover:bg-white/80 transition-colors`}>
                            <Check size={13} /> 완료
                          </button>
                        </div>
                      )}
                    </div>
                  ) : isEmpty ? (
                    <button onClick={() => toggleEditing(key)}
                      className={`w-full py-3 border-2 border-dashed ${style.border} rounded-xl text-[13px] font-medium ${style.label} hover:bg-white/60 transition-colors flex items-center justify-center gap-2`}>
                      <PenLine size={14} /> 빈칸 채우기
                    </button>
                  ) : (
                    <div className="text-[13px] text-bluewood-700 leading-[1.85] whitespace-pre-wrap">
                      <HighlightedText
                        text={value}
                        highlights={showHighlights ? (structured.highlights || []).filter(h => h.field === key) : []}
                        keywords={editedKeywords}
                        showKeywordUnderline={showHighlights}
                      />
                    </div>
                  )}

                  {/* 이미지 (아래) */}
                  <SectionImageGroup sectionKey={key} position="below"
                    sectionImages={sectionImages} allImages={allImages} imageConfig={imageConfig} setImageConfig={setImageConfig}
                    dragInfo={dragInfo} dropTarget={dropTarget} setDropTarget={setDropTarget}
                    handleDragStart={handleDragStart} handleDragEnd={handleDragEnd} handleImageDrop={handleImageDrop} />

                  {dragInfo && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDropTarget(key); }}
                      onDragLeave={() => { if (dropTarget === key) setDropTarget(null); }}
                      onDrop={(e) => handleSectionDrop(e, key)}
                      className={`mt-2 py-3 border-2 border-dashed rounded-xl text-center text-xs font-medium transition-colors ${
                        dropTarget === key ? 'border-primary-400 bg-primary-50/60 text-primary-500' : 'border-surface-200 text-bluewood-300'
                      }`}>
                      {dragInfo.fromSection === key ? '끝으로 이동' : '여기로 이미지 이동'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
      <span
        className="cursor-help font-medium transition-colors"
        style={{
          borderBottom: `2.5px solid ${color.underline}`,
          paddingBottom: '1px',
          backgroundColor: `${color.underline}10`,
        }}
      >{text}</span>
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

/* 키워드 매칭 색상 (역량 키워드별 색상 로테이션) */
const KEYWORD_COLORS = [
  '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b', '#22c55e',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

function HighlightedText({ text, highlights, keywords = [], showKeywordUnderline = false }) {
  if (!text) return <p></p>;
  // 마크다운 볼드 마커 제거 (하이라이트 위치 계산 전에)
  const cleanText = stripMarkdown(text);

  /* 1단계: 구조화 하이라이트 (AI가 표시한 핵심/파생/성장 역량) */
  const positioned = (highlights || [])
    .map(h => {
      const needle = stripMarkdown(h.text?.trim() ?? '');
      if (!needle) return null;
      if (h.start != null) return { ...h, pos: h.start, len: needle.length };
      const match = fuzzyIndexOf(cleanText, needle);
      if (!match) return null;
      return { ...h, pos: match.pos, len: match.len };
    })
    .filter(Boolean)
    .sort((a, b) => a.pos - b.pos);

  /* 2단계: 역량 키워드 밑줄 (keywords 배열에 있는 단어 매칭) */
  const kwMap = new Map(); // keyword → color
  if (showKeywordUnderline && keywords.length > 0) {
    keywords.forEach((kw, i) => {
      kwMap.set(kw.toLowerCase(), KEYWORD_COLORS[i % KEYWORD_COLORS.length]);
    });
  }

  // 구조화 하이라이트 파트 분할
  let parts = [];
  if (positioned.length > 0) {
    let lastIndex = 0;
    for (const h of positioned) {
      if (h.pos < lastIndex) continue;
      if (h.pos > lastIndex) parts.push({ text: cleanText.slice(lastIndex, h.pos), type: null, keywords: [] });
      parts.push({ text: cleanText.slice(h.pos, h.pos + h.len), type: h.type || 'core', keywords: h.keywords || [] });
      lastIndex = h.pos + h.len;
    }
    if (lastIndex < cleanText.length) parts.push({ text: cleanText.slice(lastIndex), type: null, keywords: [] });
  } else {
    parts = [{ text: cleanText, type: null, keywords: [] }];
  }

  /* 키워드 밑줄 적용 함수: 텍스트 안에서 키워드를 찾아 밑줄 span 생성 */
  const applyKeywordUnderlines = (str) => {
    if (kwMap.size === 0) return str;
    // Build regex from keywords (sorted longest first to avoid partial matches)
    const sortedKws = [...kwMap.keys()].sort((a, b) => b.length - a.length);
    const escaped = sortedKws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const segments = str.split(regex);
    if (segments.length <= 1) return str;
    return segments.map((seg, i) => {
      const color = kwMap.get(seg.toLowerCase());
      if (color) {
        return (
          <span key={i}
            className="font-semibold"
            style={{ borderBottom: `2px solid ${color}`, paddingBottom: '0.5px' }}
          >{seg}</span>
        );
      }
      return seg;
    });
  };

  return (
    <p>
      {parts.map((part, i) =>
        part.type ? (
          <HighlightSpan key={i} text={part.text} type={part.type} keywords={part.keywords} />
        ) : (
          <span key={i}>{applyKeywordUnderlines(part.text)}</span>
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
