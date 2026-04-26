import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Save, Loader2, PenLine, Check, ChevronDown, ChevronUp, GripVertical, Image as ImageIcon, ImagePlus, Target, Globe, Building2, X, RotateCcw, RotateCw, ChevronLeft, ChevronRight, Trash2, Plus, Undo2, LayoutGrid, ExternalLink, GripVertical as Grip, MoveUp, MoveDown, Eye, EyeOff } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FRAMEWORKS, JOB_CATEGORIES, JOB_SPECIFIC_FIELDS } from '../../stores/experienceStore';
import useExperienceStore from '../../stores/experienceStore';
import useAuthStore from '../../stores/authStore';
import KeyExperienceSlider from '../../components/KeyExperienceSlider';
import { JobAnalysisBadge } from '../../components/JobLinkInput';
import { analyzeJobUrl } from '../../services/jobAI';
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

/* ── 핵심 경험 슬라이드 (미리보기 전용 서브 컴포넌트) ── */
function PreviewKeySlides({ keyExperiences }) {
  const [slideIdx, setSlideIdx] = useState(0);
  if (!keyExperiences || keyExperiences.length === 0) return null;
  const ke = keyExperiences[Math.min(slideIdx, keyExperiences.length - 1)];
  return (
    <div className="mb-8">
      <h2 className="text-[12px] font-bold uppercase tracking-widest text-bluewood-400 border-b border-surface-200 pb-2 mb-4">핵심 경험 &amp; 성과</h2>
      <div className="bg-surface-50 border border-surface-200 rounded-xl overflow-hidden">
        <div className="p-5">
          {ke.title && <p className="text-[14px] font-bold text-bluewood-900 mb-3">{ke.title}</p>}
          {(ke.metric || ke.afterMetric) && (
            <div className="flex items-center gap-3 mb-3 p-3 bg-primary-50 rounded-lg border border-primary-100">
              {ke.beforeMetric && (
                <>
                  <span className="text-[13px] text-bluewood-400">{ke.metricLabel || ''}</span>
                  <span className="text-[18px] font-bold text-bluewood-500">{ke.beforeMetric}</span>
                  <span className="text-bluewood-300 text-sm">→</span>
                </>
              )}
              <span className="text-[22px] font-extrabold text-primary-600">{ke.afterMetric || ke.metric}</span>
              {!ke.beforeMetric && ke.metricLabel && <span className="text-[12px] text-bluewood-400">{ke.metricLabel}</span>}
            </div>
          )}
          {ke.situation && <p className="text-[13px] text-bluewood-500 leading-relaxed mb-1"><span className="font-semibold text-bluewood-600">상황 </span>{ke.situation}</p>}
          {ke.action && <p className="text-[13px] text-bluewood-500 leading-relaxed mb-1"><span className="font-semibold text-bluewood-600">액션 </span>{ke.action}</p>}
          {ke.result && <p className="text-[13px] text-bluewood-500 leading-relaxed"><span className="font-semibold text-bluewood-600">결과 </span>{ke.result}</p>}
          {ke.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {ke.keywords.map((kw, i) => <span key={i} className="px-2 py-0.5 bg-primary-100 text-primary-600 rounded text-[11px] font-medium">{kw}</span>)}
            </div>
          )}
        </div>
        {keyExperiences.length > 1 && (
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-surface-200 bg-white">
            <button onClick={() => setSlideIdx(i => Math.max(0, i - 1))} disabled={slideIdx === 0}
              className="text-[12px] text-bluewood-400 hover:text-bluewood-700 disabled:opacity-30 px-2 py-1">◀ 이전</button>
            <span className="text-[11px] text-bluewood-300">{slideIdx + 1} / {keyExperiences.length}</span>
            <button onClick={() => setSlideIdx(i => Math.min(keyExperiences.length - 1, i + 1))} disabled={slideIdx === keyExperiences.length - 1}
              className="text-[12px] text-bluewood-400 hover:text-bluewood-700 disabled:opacity-30 px-2 py-1">다음 ▶</button>
          </div>
        )}
      </div>
    </div>
  );
}

// 하이라이트 색상 매핑 (밑줄 스타일)
const highlightColors = {
  core:    { underline: '#ef4444', bg: 'bg-red-50',   label: '핵심 역량', desc: '이 경험에서 발휘된 핵심 역량입니다',       dot: 'bg-red-400',   text: 'text-red-700'   },
  derived: { underline: '#f59e0b', bg: 'bg-amber-50', label: '파생 역량', desc: '핵심 역량에서 파생된 부가적인 역량입니다', dot: 'bg-amber-400', text: 'text-amber-700' },
  growth:  { underline: '#22c55e', bg: 'bg-green-50', label: '성장 관점', desc: '이 경험을 통해 성장하거나 배운 내용입니다', dot: 'bg-green-400', text: 'text-green-700' },
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

/* ── 역량 키워드 카테고리 스타일 ── */
const KW_CATEGORY_STYLES = {
  tech:       { dot: '#0284c7', bg: 'bg-sky-50',      text: 'text-sky-700',      border: 'border-sky-200',     label: '기술'   },
  soft:       { dot: '#059669', bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200', label: '소통'   },
  leadership: { dot: '#7c3aed', bg: 'bg-violet-50',   text: 'text-violet-700',   border: 'border-violet-200',  label: '리더십' },
  planning:   { dot: '#d97706', bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200',   label: '기획'   },
  default:    { dot: '#4f46e5', bg: 'bg-primary-50',  text: 'text-primary-700',  border: 'border-primary-100', label: '역량'   },
};
const KW_CATEGORY_ORDER = ['tech', 'soft', 'leadership', 'planning', 'default'];

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
  const [searchParams] = useSearchParams();
  const viewOnly = searchParams.get('view') === 'true';
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
  const sectionTextareaRefs = useRef({});
  // 핵심 경험 슬라이더 ref & 동기화 state
  const sliderRef = useRef(null);
  const [sliderEditing, setSliderEditing] = useState(false);
  const [sliderCurrent, setSliderCurrent] = useState(0);
  const [sliderDeletedCount, setSliderDeletedCount] = useState(0);

  /* ── 역량 키워드 커스터마이징 ── */
  const [newKeywordIdx, setNewKeywordIdx] = useState(null);     // 팝인 애니메이션 대상 인덱스
  const [kwDragIdx, setKwDragIdx] = useState(null);             // 드래그 중인 키워드 인덱스
  const [kwOverIdx, setKwOverIdx] = useState(null);             // 드롭 대상 인덱스
  const [keywordCategories, setKeywordCategories] = useState({}); // keyword → 카테고리 key
  const [flashedSection, setFlashedSection] = useState(null);   // 섹션 완성 피드백

  /* ── 직군 특화 섹션 ── */
  const [jobCategory, setJobCategory] = useState('common');
  const [editedJobSpecific, setEditedJobSpecific] = useState({});
  const [editingJobSections, setEditingJobSections] = useState({});

  /* ── 포트폴리오 내보내기 커스텀 패널 ── */
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportEnabled, setExportEnabled] = useState({});
  const [exportOrder, setExportOrder] = useState([]);
  const [exportCoverImg, setExportCoverImg] = useState(null);

  /* ── 프로젝트 타임라인용: 전체 경험 목록 로드 ── */
  const { experiences, fetchExperiences, undoEdit, redoEdit, canUndo, canRedo, pushEditSnapshot } = useExperienceStore();
  useEffect(() => {
    if (user?.uid && experiences.length === 0) fetchExperiences(user.uid);
  }, [user?.uid]);

  // 기업 분석 관련 state
  const [jobAnalysis, setJobAnalysis] = useState(null);
  const [jobUrl, setJobUrl] = useState('');
  const [analyzingJob, setAnalyzingJob] = useState(false);
  const [jobError, setJobError] = useState(null);
  const [showJobInput, setShowJobInput] = useState(false);

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
      const normStack1 = structured.projectOverview?.techStack;
      setEditedOverview({
        background: structured.projectOverview?.background || '',
        goal: structured.projectOverview?.goal || '',
        role: structured.projectOverview?.role || '',
        team: structured.projectOverview?.team || '',
        duration: structured.projectOverview?.duration || '',
        summary: structured.projectOverview?.summary || '',
        techStack: Array.isArray(normStack1) ? normStack1 : (normStack1 ? String(normStack1).split(',').map(s => s.trim()).filter(Boolean) : []),
      });
      setEditedKeywords(structured.keywords || []);
      setEditedKeyExperiences((structured.keyExperiences || []).map(e => ({ ...e })));
      setJobCategory(structured.jobCategory || 'common');
      setEditedJobSpecific(structured.jobSpecific || {});
      if (!viewOnly) {
        // 비어있거나 아니거나 모든 섹션을 즐시 편집 모드로
        const autoEdit = {};
        SECTION_KEYS.forEach(k => { autoEdit[k] = true; });
        setEditingSections(autoEdit);
      }
      // Load images & jobAnalysis from Firestore (navState doesn't include them)
      (async () => {
        try {
          const docSnap = await getDoc(doc(db, 'experiences', id));
          if (docSnap.exists()) {
            const data = docSnap.data();
            const imgs = data.images || [];
            setAllImages(imgs);
            setSectionImages(data.sectionImages || { _unassigned: imgs.map((_, i) => i) });
            setImageConfig(data.imageConfig || {});
            setJobAnalysis(data.jobAnalysis || null);
            if (data.jobCategory) setJobCategory(data.jobCategory);
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
        setJobAnalysis(data.jobAnalysis || null);
        const imgs = data.images || [];
        setAllImages(imgs);
        setSectionImages(data.sectionImages || { _unassigned: imgs.map((_, i) => i) });
        setImageConfig(data.imageConfig || {});
        const fields = pickSectionFields(data.structuredResult || data.content || {});
        setEditedContent(fields);
        const sr = data.structuredResult || {};
        setEditedTitle(data.title || '');
        const normStack2 = sr.projectOverview?.techStack;
        setEditedOverview({
          background: sr.projectOverview?.background || '',
          goal: sr.projectOverview?.goal || '',
          role: sr.projectOverview?.role || '',
          team: sr.projectOverview?.team || '',
          duration: sr.projectOverview?.duration || '',
          summary: sr.projectOverview?.summary || '',
          techStack: Array.isArray(normStack2) ? normStack2 : (normStack2 ? String(normStack2).split(',').map(s => s.trim()).filter(Boolean) : []),
        });
        setEditedKeywords(sr.keywords || data.keywords || []);
        setEditedKeyExperiences((sr.keyExperiences || []).map(e => ({ ...e })));
        setJobCategory(data.jobCategory || sr.jobCategory || 'common');
        setEditedJobSpecific(sr.jobSpecific || {});
        setExportCoverImg(sr.exportConfig?.coverImg || null);
        if (!viewOnly) {
          // 모든 섹션 즉시 오픈 (딩칸/채워진 관계없이)
          const autoEdit = {};
          SECTION_KEYS.forEach(k => { autoEdit[k] = true; });
          setEditingSections(autoEdit);
        }
      }
    } catch (error) {
      console.error('경험 로딩 실패:', error);
    }
    setLoading(false);
  };

  const handleFieldChange = (key, value) => {
    // 빈칸/초안 → 충분한 내용으로 완성될 때 섹션 완성 피드백
    const currentVal = editedContent[key];
    const wasEmpty = !currentVal?.trim() || currentVal.trim().startsWith('[작성 필요]');
    const isNowFilled = !!value.trim() && !value.trim().startsWith('[작성 필요]') && value.trim().length > 15;
    setEditedContent(prev => ({ ...prev, [key]: value }));
    if (wasEmpty && isNowFilled) {
      setFlashedSection(key);
      setTimeout(() => setFlashedSection(null), 1300);
    }
  };

  const toggleEditing = (key) => {
    setEditingSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /* ── 역량 키워드 드래그-재정렬 ── */
  const handleKwDragEnd = () => {
    if (kwDragIdx != null && kwOverIdx != null && kwDragIdx !== kwOverIdx) {
      setEditedKeywords(prev => {
        const next = [...prev];
        const [moved] = next.splice(kwDragIdx, 1);
        next.splice(kwOverIdx, 0, moved);
        return next;
      });
    }
    setKwDragIdx(null);
    setKwOverIdx(null);
  };

  /* ── 역량 카테고리 사이클 ── */
  const cycleKwCategory = (k) => {
    setKeywordCategories(prev => {
      const cur = prev[k] || 'default';
      const idx = KW_CATEGORY_ORDER.indexOf(cur);
      return { ...prev, [k]: KW_CATEGORY_ORDER[(idx + 1) % KW_CATEGORY_ORDER.length] };
    });
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
        const updatedSection = { ...sectionImages, _unassigned: unassigned };
        setSectionImages(updatedSection);
        const docRef = doc(db, 'experiences', id);
        await updateDoc(docRef, { images: updatedAll, sectionImages: updatedSection, updatedAt: new Date() });
        toast.success(`${newImgs.length}장 업로드 완료`);
      }
    } catch (err) {
      console.error('이미지 업로드 실패:', err);
      toast.error('이미지 업로드 실패');
    }
    setUploadingImage(false);
    e.target.value = '';
  };

  const handleImageDelete = async (imgIdx) => {
    const updatedAll = allImages.filter((_, i) => i !== imgIdx);
    const remap = (arr) => arr
      .filter(i => i !== imgIdx)
      .map(i => i > imgIdx ? i - 1 : i);
    const updatedSection = {};
    Object.entries(sectionImages).forEach(([k, v]) => { updatedSection[k] = remap(v); });
    setAllImages(updatedAll);
    setSectionImages(updatedSection);
    try {
      const docRef = doc(db, 'experiences', id);
      await updateDoc(docRef, { images: updatedAll, sectionImages: updatedSection, updatedAt: new Date() });
    } catch {}
  };

  // 기업 분석 핸들러
  const handleJobAnalyze = async () => {
    if (!jobUrl.trim()) return;
    setAnalyzingJob(true);
    setJobError(null);
    try {
      const respData = await analyzeJobUrl(jobUrl);
      const analysis = respData.analysis;
      setJobAnalysis(analysis);
      setShowJobInput(false);
      setJobUrl('');
      await updateDoc(doc(db, 'experiences', id), { jobAnalysis: analysis, updatedAt: new Date() });
      toast.success('기업 분석이 완료되었습니다');
    } catch (err) {
      setJobError(err.response?.data?.error || '분석에 실패했습니다');
    }
    setAnalyzingJob(false);
  };

  const handleRemoveJobAnalysis = async () => {
    setJobAnalysis(null);
    try {
      await updateDoc(doc(db, 'experiences', id), { jobAnalysis: null, updatedAt: new Date() });
    } catch {}
  };

  // 모든 섹션 지정 토글 — 빈칸은 자동 폈치되지 않음
  const handleStartEditing = (key) => {
    // 편집 시작 전 히스토리 스냅샷 저장
    if (!editingSections[key]) {
      pushEditSnapshot(id, {
        content: { ...editedContent },
        title: editedTitle,
        structuredResult: experience?.structuredResult,
      });
    }
    // 모든 섹션을 한 번에 편집 모드로 (사용자가 수정 버튼을 누른 의도 매쳩)
    setEditingSections(prev => {
      const allOn = {};
      SECTION_KEYS.forEach(k => { allOn[k] = true; });
      // 이미 모두 열려있으면 클릭한 � 하나만 토글
      const allAlreadyOpen = SECTION_KEYS.every(k => prev[k]);
      if (allAlreadyOpen) {
        return { ...prev, [key]: false };
      }
      // 아니면 모두 열기
      requestAnimationFrame(() => {
        const el = sectionTextareaRefs.current[key];
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
      return allOn;
    });
  };

  // 수정하기 시작 시 모든 섹션 오픈
  const openAllSections = () => {
    pushEditSnapshot(id, {
      content: { ...editedContent },
      title: editedTitle,
      structuredResult: experience?.structuredResult,
    });
    const allOn = {};
    SECTION_KEYS.forEach(k => { allOn[k] = true; });
    setEditingSections(allOn);
  };

  const handleUndo = () => {
    const snapshot = undoEdit(id);
    if (!snapshot) return;
    if (snapshot.content) setEditedContent(snapshot.content);
    if (snapshot.title !== undefined) setEditedTitle(snapshot.title);
    toast('이전 내용으로 되돌렸습니다', { icon: '↩️' });
  };

  const handleRedo = () => {
    const snapshot = redoEdit(id);
    if (!snapshot) return;
    if (snapshot.content) setEditedContent(snapshot.content);
    if (snapshot.title !== undefined) setEditedTitle(snapshot.title);
    toast('다시 실행했습니다', { icon: '↪️' });
  };

  // Ctrl+Z / Ctrl+Y 단축키 — handleUndo/handleRedo 정의 이후에 등록
  useEffect(() => {
    if (viewOnly) return;
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const snapshot = undoEdit(id);
        if (snapshot) {
          if (snapshot.content) setEditedContent(snapshot.content);
          if (snapshot.title !== undefined) setEditedTitle(snapshot.title);
          toast('이전 내용으로 되돌렸습니다', { icon: '↩️' });
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const snapshot = redoEdit(id);
        if (snapshot) {
          if (snapshot.content) setEditedContent(snapshot.content);
          if (snapshot.title !== undefined) setEditedTitle(snapshot.title);
          toast('다시 실행했습니다', { icon: '↪️' });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewOnly, id]);

  const handleSave = async () => {
    setSaving(true);
    // 저장 전 현재 상태를 히스토리에 스냅샷 저장 → 저장 후에도 되돌리기 가능
    pushEditSnapshot(id, {
      content: { ...editedContent },
      title: editedTitle,
      structuredResult: experience?.structuredResult,
    });
    try {
      const ref = doc(db, 'experiences', id);
      const updatedStructured = {
        ...(experience.structuredResult || {}),
        ...editedContent,
        projectOverview: { ...editedOverview },
        keywords: editedKeywords,
        keyExperiences: editedKeyExperiences,
        jobCategory,
        jobSpecific: editedJobSpecific,
        exportConfig: (() => {
          const prevCfg = experience?.structuredResult?.exportConfig || {};
          const order = prevCfg.sectionOrder?.length ? prevCfg.sectionOrder : exportOrder;
          const enabled = prevCfg.enabledMap || exportEnabled;
          const jobSects = (JOB_SPECIFIC_FIELDS[jobCategory] || []).map(s => ({ key: s.key, label: s.label, type: 'job' }));
          const baseSects = SECTION_KEYS.map(k => ({ key: k, label: SECTION_META[k].label, type: 'base' }));
          const allSectMap = Object.fromEntries([...jobSects, ...baseSects].map(s => [s.key, s]));
          const getSec = (key) => {
            const jd = (JOB_SPECIFIC_FIELDS[jobCategory] || []).find(s => s.key === key);
            return jd ? (editedJobSpecific[key] || '') : (editedContent[key] || '');
          };
          return {
            ...prevCfg,
            sectionOrder: order,
            enabledMap: enabled,
            coverImg: exportCoverImg || prevCfg.coverImg || null,
            sections: order
              .filter(k => enabled[k] !== false)
              .map(k => ({ key: k, label: allSectMap[k]?.label || k, type: allSectMap[k]?.type || 'base', content: getSec(k) }))
              .filter(s => s.content?.trim()),
          };
        })(),
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
      navigate(`/app/experience/structured/${id}?view=true`, { replace: true });
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
    setSaving(false);
  };

  const filledCount = SECTION_KEYS.filter(k => { const v = editedContent[k]?.trim(); return v && !v.startsWith('[작성 필요]'); }).length;
  const emptyCount = SECTION_KEYS.length - filledCount;

  /* ── 포트폴리오 내보내기 섹션 목록 초기화 ── */
  useEffect(() => {
    const jobSects = (JOB_SPECIFIC_FIELDS[jobCategory] || []).map(s => ({ key: s.key, label: s.label, type: 'job' }));
    const baseSects = SECTION_KEYS.map(k => ({ key: k, label: SECTION_META[k].label, type: 'base' }));
    const allSects = [...jobSects, ...baseSects];
    setExportOrder(allSects.map(s => s.key));
    const enabled = {};
    allSects.forEach(s => { enabled[s.key] = true; });
    setExportEnabled(enabled);
  }, [jobCategory]);

  /* 포트폴리오 내보내기 핸들러 */
  const handleExportToPortfolio = () => {
    const jobSects = (JOB_SPECIFIC_FIELDS[jobCategory] || []).map(s => ({ key: s.key, label: s.label, type: 'job' }));
    const baseSects = SECTION_KEYS.map(k => ({ key: k, label: SECTION_META[k].label, type: 'base' }));
    const allSectMap = Object.fromEntries([...jobSects, ...baseSects].map(s => [s.key, s]));

    // 선택된 섹션만, 사용자 지정 순서로
    const orderedEnabled = exportOrder.filter(k => exportEnabled[k]);
    const sr = experience?.structuredResult || {};

    // 각 섹션의 내용 매핑
    const getSectionContent = (key) => {
      const jobSectDef = (JOB_SPECIFIC_FIELDS[jobCategory] || []).find(s => s.key === key);
      if (jobSectDef) return editedJobSpecific[key] || sr.jobSpecific?.[key] || '';
      return editedContent[key] || sr[key] || '';
    };

    const exportConfig = {
      experienceId: id,
      title: editedTitle,
      jobCategory,
      sectionOrder: orderedEnabled,
      sections: orderedEnabled.map(key => ({
        key,
        label: allSectMap[key]?.label || key,
        type: allSectMap[key]?.type || 'base',
        content: getSectionContent(key),
      })).filter(s => s.content?.trim()),
      structuredResult: { ...sr, ...editedContent, jobSpecific: editedJobSpecific },
      keywords: editedKeywords,
      keyExperiences: editedKeyExperiences,
      projectOverview: editedOverview,
    };

    navigate('/app/portfolio', { state: { exportConfig } });
  };

  /* 포트폴리오 미리보기 - 섹션 구성 Firestore 저장 */
  const handleSaveExportConfig = async () => {
    const jobSects = (JOB_SPECIFIC_FIELDS[jobCategory] || []).map(s => ({ key: s.key, label: s.label, type: 'job' }));
    const baseSects = SECTION_KEYS.map(k => ({ key: k, label: SECTION_META[k].label, type: 'base' }));
    const allSectMap = Object.fromEntries([...jobSects, ...baseSects].map(s => [s.key, s]));
    const orderedEnabled = exportOrder.filter(k => exportEnabled[k] !== false);
    const getSectionContent = (key) => {
      const jobDef = (JOB_SPECIFIC_FIELDS[jobCategory] || []).find(s => s.key === key);
      if (jobDef) return editedJobSpecific[key] || '';
      return editedContent[key] || '';
    };
    const exportConfigData = {
      sectionOrder: exportOrder,
      enabledMap: exportEnabled,
      sections: orderedEnabled.map(key => ({
        key,
        label: allSectMap[key]?.label || key,
        type: allSectMap[key]?.type || 'base',
        content: getSectionContent(key),
      })).filter(s => s.content?.trim()),
      coverImg: exportCoverImg || null,
      savedAt: new Date(),
    };
    try {
      await updateDoc(doc(db, 'experiences', id), {
        'structuredResult.exportConfig': exportConfigData,
        updatedAt: new Date(),
      });
      setExperience(prev => prev ? {
        ...prev,
        structuredResult: { ...(prev.structuredResult || {}), exportConfig: exportConfigData },
      } : prev);
      toast.success('포트폴리오 구성이 저장되었습니다');
      setShowExportPanel(false);
    } catch {
      toast.error('저장에 실패했습니다');
    }
  };

  /* 포트폴리오 내보내기 패널 - 섹션 이동 */
  const moveExportSection = (idx, dir) => {
    setExportOrder(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  /* 페이지 전체 품질 체크리스트 */
  const qualityChecks = [
    { id: 'title',          label: '프로젝트 제목',     check: () => !!editedTitle.trim() },
    { id: 'techStack',      label: '기술 스택 입력',    check: () => editedOverview.techStack.length > 0 },
    { id: 'keywords',       label: '키워드 3개 이상',   check: () => editedKeywords.length >= 3 },
    { id: 'keyExperiences', label: '핵심 경험 추가',    check: () => editedKeyExperiences.length > 0 },
    { id: 'role',           label: '내 역할 명시',      check: () => !!editedOverview.role?.trim() },
    { id: 'duration',       label: '프로젝트 기간',     check: () => !!editedOverview.duration?.trim() },
    { id: 'metrics',        label: '수치/성과 포함',    check: () => SECTION_KEYS.some(k => /\d+\s*[%배ms개원만억]/.test(editedContent[k] || '')) },
    { id: 'images',         label: '이미지 첨부',       check: () => allImages.length > 0 },
    { id: 'sections',       label: `7개 섹션 완성 (${filledCount}/7)`, check: () => filledCount === 7 },
  ];
  const passedChecks = qualityChecks.filter(c => c.check()).length;
  const qualityPct = Math.round((passedChecks / qualityChecks.length) * 100);

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
    <>
    <div style={{ transform: 'scale(0.9)', transformOrigin: 'top left', width: '111.11%' }}>
    <div className="animate-fadeIn max-w-[1400px] mx-auto px-6 pb-12">
      {/* 상단 네비 + 저장/수정 */}
      <div className="flex items-center justify-between mb-5">
        <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-bluewood-400 hover:text-bluewood-600 transition-colors">
          <ArrowLeft size={16} /> 경험 목록으로
        </Link>
        {viewOnly ? (
          <button
            onClick={() => navigate(`/app/experience/structured/${id}`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-surface-200 text-bluewood-700 rounded-xl text-sm font-medium hover:bg-surface-50 transition-colors shadow-sm"
          >
            <PenLine size={14} />
            수정하기
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {/* 텍스트 히스토리 undo/redo */}
            <button onClick={handleUndo} disabled={!canUndo(id)} title="이전으로 되돌리기 (Ctrl+Z)"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white border border-surface-200 text-bluewood-500 rounded-xl text-sm hover:bg-surface-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm">
              <RotateCcw size={14} />
            </button>
            <button onClick={handleRedo} disabled={!canRedo(id)} title="다시 실행 (Ctrl+Y)"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white border border-surface-200 text-bluewood-500 rounded-xl text-sm hover:bg-surface-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm">
              <RotateCw size={14} />
            </button>

            {/* 구분선 + 핵심경험 슬라이더 컨트롤 */}
            {editedKeyExperiences.length > 0 && (
              <>
                <div className="w-px h-6 bg-surface-200 mx-1" />
                {/* 인디케이터 */}
                <div className="flex items-center gap-1">
                  {editedKeyExperiences.map((_, i) => {
                    const colors = ['#ef4444', '#2563eb', '#7c3aed'];
                    return (
                      <button key={i} onClick={() => sliderRef.current?.goTo(i)} className="p-0.5">
                        <div className={`h-[6px] rounded-full transition-all duration-300 ${i === sliderCurrent ? 'w-5' : 'w-[6px] hover:w-3'}`}
                          style={{ backgroundColor: i === sliderCurrent ? colors[i % 3] : '#d1d5db' }} />
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-bluewood-400 tabular-nums font-medium">{sliderCurrent + 1}/{editedKeyExperiences.length}</span>
                <button onClick={() => sliderRef.current?.goPrev()}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-surface-200 hover:bg-surface-50 active:scale-95 transition-all">
                  <ChevronLeft size={16} className="text-bluewood-500" />
                </button>
                <button onClick={() => sliderRef.current?.goNext()}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-surface-200 hover:bg-surface-50 active:scale-95 transition-all">
                  <ChevronRight size={16} className="text-bluewood-500" />
                </button>
                {/* 삭제된 항목 되돌리기 */}
                {sliderDeletedCount > 0 && (
                  <button onClick={() => sliderRef.current?.undoDelete()}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-all shadow-sm">
                    <Undo2 size={12} /> ({sliderDeletedCount})
                  </button>
                )}
                {/* 수정 / 저장·취소·삭제 */}
                {!sliderEditing ? (
                  <button onClick={() => sliderRef.current?.startEditing()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-white text-bluewood-500 border-surface-200 hover:bg-surface-50 transition-all shadow-sm">
                    <PenLine size={13} /> 수정
                  </button>
                ) : (
                  <>
                    <button onClick={() => sliderRef.current?.deleteSlide()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-white text-red-400 border-red-200 hover:bg-red-50 transition-all">
                      <Trash2 size={13} /> 삭제
                    </button>
                    <button onClick={() => sliderRef.current?.cancelEditing()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-white text-bluewood-400 border-surface-200 hover:bg-surface-50 transition-all">
                      <X size={13} /> 취소
                    </button>
                    <button onClick={() => sliderRef.current?.saveEditing()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-primary-500 text-white border-primary-500 shadow-sm hover:bg-primary-600 transition-all">
                      <Check size={13} /> 저장
                    </button>
                  </>
                )}
                <div className="w-px h-6 bg-surface-200 mx-1" />
              </>
            )}

            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-card">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? '저장 중...' : '저장하기'}
            </button>
            <button
              onClick={() => setShowExportPanel(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-card">
              포트폴리오 미리보기
            </button>
          </div>
        )}
      </div>

      {/* ── 메인 + 우측 기업분석 사이드바 ── */}
      <div className="flex gap-5 items-start">
        {/* 메인 콘텐츠 */}
        <div className="flex-1 min-w-0">

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
            readOnly={viewOnly}
            className={`text-lg font-bold text-bluewood-900 leading-snug mb-2 bg-transparent border-b border-transparent ${viewOnly ? '' : 'hover:border-surface-200 focus:border-primary-400'} focus:outline-none transition-colors px-0 py-0.5 w-full`}
            placeholder="프로젝트 제목"
          />

          {/* 배경/요약 (편집) */}
          <textarea
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
            value={editedOverview.background || editedOverview.summary || ''}
            onChange={e => { setEditedOverview(prev => ({ ...prev, background: e.target.value })); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            readOnly={viewOnly}
            className={`text-[12.5px] text-bluewood-400 leading-relaxed mb-5 bg-transparent border border-transparent ${viewOnly ? '' : 'hover:border-surface-200 focus:border-primary-300'} focus:outline-none rounded-lg p-1.5 resize-none transition-colors w-full overflow-hidden`}
            style={{ minHeight: '4.5rem' }}
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
                  <textarea
                    ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                    value={editedOverview[item.key] || ''}
                    onChange={e => { setEditedOverview(prev => ({ ...prev, [item.key]: e.target.value })); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    readOnly={viewOnly}
                    rows={1}
                    className={`w-full text-[12px] text-bluewood-500 leading-relaxed bg-transparent border-b border-transparent ${viewOnly ? '' : 'hover:border-surface-200 focus:border-primary-300'} focus:outline-none transition-colors py-0.5 resize-none overflow-hidden`}
                    placeholder={item.placeholder}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 기술 스택 (편집) */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(Array.isArray(editedOverview.techStack) ? editedOverview.techStack : []).map((tech, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-100 text-bluewood-600 rounded-md text-[11px] font-medium border border-surface-200 group/tech">
                  {tech}
                  {!viewOnly && (
                    <button onClick={() => setEditedOverview(prev => ({ ...prev, techStack: prev.techStack.filter((_, j) => j !== i) }))}
                      className="text-bluewood-300 hover:text-red-500 transition-colors ml-0.5 text-[10px]">×</button>
                  )}
                </span>
              ))}
            </div>
            {!viewOnly && (
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
            )}
          </div>

          {/* 역량 키워드 — 카테고리·드래그·팝인 애니메이션 */}
          <div className="mt-auto pt-4 border-t border-surface-100">
            {/* 카테고리 범례 */}
            {editedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {KW_CATEGORY_ORDER.map(cat => {
                  const cs = KW_CATEGORY_STYLES[cat];
                  const count = editedKeywords.filter(k => (keywordCategories[k] || 'default') === cat).length;
                  if (count === 0) return null;
                  return (
                    <span key={cat} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${cs.bg} ${cs.text} ${cs.border} border`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cs.dot }} />
                      {cs.label} {count}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {editedKeywords.map((k, i) => {
                const catKey = keywordCategories[k] || 'default';
                const cs = KW_CATEGORY_STYLES[catKey];
                const isNew = i === newKeywordIdx;
                const isDragging = kwDragIdx === i;
                const isOver = kwOverIdx === i && kwDragIdx !== i;
                return (
                  <span
                    key={`${k}-${i}`}
                    draggable={!viewOnly}
                    onDragStart={() => !viewOnly && setKwDragIdx(i)}
                    onDragOver={e => { e.preventDefault(); if (!viewOnly) setKwOverIdx(i); }}
                    onDragEnd={handleKwDragEnd}
                    onClick={() => !viewOnly && cycleKwCategory(k)}
                    title={!viewOnly ? `${cs.label} — 클릭: 분류 변경 / 드래그: 순서 변경` : cs.label}
                    className={[
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all duration-200 select-none',
                      cs.bg, cs.text, cs.border,
                      !viewOnly ? 'cursor-grab active:cursor-grabbing' : '',
                      isNew ? 'animate-pop-in animate-skill-shimmer' : '',
                      isDragging ? 'opacity-40 scale-95' : '',
                      isOver ? 'ring-2 ring-offset-1 ring-primary-400 scale-[1.04]' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cs.dot }} />
                    {k}
                    {!viewOnly && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditedKeywords(prev => prev.filter((_, j) => j !== i));
                          setKeywordCategories(prev => { const n = { ...prev }; delete n[k]; return n; });
                        }}
                        className="opacity-40 hover:opacity-100 hover:text-red-500 transition-all ml-0.5 text-[10px]"
                      >×</button>
                    )}
                  </span>
                );
              })}
            </div>
            {!viewOnly && (
              <>
              <div className="flex gap-1.5">
                <input
                  value={newKeywordInput}
                  onChange={e => setNewKeywordInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newKeywordInput.trim()) {
                      e.preventDefault();
                      const newIdx = editedKeywords.length;
                      setEditedKeywords(prev => [...prev, newKeywordInput.trim()]);
                      setNewKeywordIdx(newIdx);
                      setTimeout(() => setNewKeywordIdx(null), 900);
                      setNewKeywordInput('');
                    }
                  }}
                  className="flex-1 text-[11px] bg-surface-50 border border-surface-200 rounded-md px-2 py-1 focus:outline-none focus:border-primary-300 transition-colors"
                  placeholder="스킬 추가 후 Enter"
                />
              </div>
              {editedKeywords.length > 0 && (
                <p className="text-[9.5px] text-bluewood-300 mt-1.5 leading-relaxed">
                  클릭해서 분류 변경 · 드래그해서 순서 변경
                </p>
              )}
              </>
            )}
          </div>
        </div>

        {/* ── 우: 핵심 경험 슬라이더 (편집 가능) ── */}
        <div className="min-w-0">
          <KeyExperienceSlider
            ref={sliderRef}
            keyExperiences={editedKeyExperiences}
            onUpdate={viewOnly ? undefined : setEditedKeyExperiences}
            viewOnly={viewOnly}
            hideHeader={!viewOnly}
            onEditingChange={setSliderEditing}
            onCurrentChange={setSliderCurrent}
            onDeletedCountChange={setSliderDeletedCount}
          />
        </div>
      </div>

      {/* ╔══════════════════════════════════════════════╗
         ║  하단 좌: 작성 완성도 + 사진 / 우: 힌트     ║
         ╚══════════════════════════════════════════════╝ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* 작성 완성도 — 페이지 전체 품질 체크리스트 */}
        <div className="bg-white rounded-2xl border border-surface-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-extrabold text-bluewood-900">작성 완성도</h3>
            <span className="text-[12px] font-bold text-caribbean-600">{passedChecks}/{qualityChecks.length}</span>
          </div>
          {/* 프로그레스 바 */}
          <div className="w-full h-1.5 bg-surface-100 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-caribbean-400 rounded-full transition-all duration-500"
              style={{ width: `${qualityPct}%` }}
            />
          </div>
          {/* 품질 체크리스트 */}
          <ul className="space-y-2">
            {qualityChecks.map(item => {
              const passed = item.check();
              return (
                <li key={item.id} className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${passed ? 'bg-caribbean-400' : 'bg-surface-100 border border-surface-200'}`}>
                    {passed && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={`text-[12px] font-medium leading-none ${passed ? 'text-bluewood-700' : 'text-bluewood-300'}`}>
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ul>
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
                      <button
                        onClick={(e) => { e.stopPropagation(); handleImageDelete(imgIdx); }}
                        className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center transition-opacity hover:bg-red-600"
                      >
                        <X size={9} />
                      </button>
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
         ║  직군 특화 핵심 분석 섹션 (7개 섹션 위)       ║
         ╚══════════════════════════════════════════════╝ */}
      {(() => {
        const jobSections = JOB_SPECIFIC_FIELDS[jobCategory] || [];
        if (jobSections.length === 0) return null;

        const jobMeta = JOB_CATEGORIES.flatMap(g => g.items).find(it => it.value === jobCategory);
        const jobLabel = jobMeta?.label || jobCategory;

        return (
          <div className="bg-white border border-surface-200 rounded-2xl shadow-sm overflow-hidden">
            {/* 직군 특화 헤더 */}
            <div className="flex items-center gap-3 px-6 py-4 bg-primary-50/40 border-b border-primary-100">
              <span className="px-2.5 py-1 bg-primary-100 text-primary-700 rounded-lg text-[11px] font-bold tracking-wide uppercase">직군 특화</span>
              <span className="text-[14px] font-semibold text-bluewood-700">{jobLabel} 핵심 분석 섹션</span>
              <span className="text-[12px] text-bluewood-400 ml-1">— 채용 담당자가 가장 주목하는 항목</span>
            </div>

            <div className="divide-y divide-surface-100">
              {jobSections.map((field, idx) => {
                const val = editedJobSpecific[field.key] || '';
                const isTrulyEmpty = !val.trim();
                const isDraft = !isTrulyEmpty && val.trim().startsWith('[작성 필요]');
                const isEditing = editingJobSections[field.key];

                return (
                  <div key={field.key} className="group">
                    {/* 섹션 헤더 */}
                    <div className="flex items-center gap-4 px-6 py-3 bg-primary-50/20">
                      <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center text-[11px] font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-bold text-primary-700">{field.label}</span>
                        {field.subtitle && <span className="text-[11px] text-bluewood-300 ml-2">{field.subtitle}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {isTrulyEmpty ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-[10px] font-semibold">빈칸</span>
                        ) : isDraft ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded text-[10px] font-semibold">초안</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-caribbean-50 text-caribbean-600 rounded text-[10px] font-semibold">완료</span>
                        )}
                        {!isEditing && !isTrulyEmpty && !viewOnly && (
                          <button
                            onClick={() => setEditingJobSections(p => ({ ...p, [field.key]: true }))}
                            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-2 py-1 text-[11px] text-bluewood-400 hover:text-primary-600 bg-white rounded-md border border-surface-200 transition-all">
                            <PenLine size={11} /> 수정
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 섹션 본문 */}
                    <div className="px-6 py-4 pl-[60px]">
                      {isEditing ? (
                        <div>
                          <p className="text-[11px] text-primary-400 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 mb-3 leading-relaxed">
                            💡 <strong>{field.subtitle}</strong><br />{field.placeholder}
                          </p>
                          <textarea
                            value={val.startsWith('[작성 필요]') ? val.replace(/^\[작성 필요\]\s*/, '') : val}
                            onChange={e => {
                              const v = e.target.value;
                              setEditedJobSpecific(p => ({ ...p, [field.key]: v }));
                              const t = e.target; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px';
                            }}
                            placeholder={field.placeholder || '내용을 입력하세요'}
                            className="w-full bg-white rounded-xl border border-primary-200 p-4 text-[13px] outline-none focus:ring-2 focus:ring-primary-300 transition-shadow resize-none overflow-hidden text-bluewood-800 placeholder-bluewood-300"
                            style={{ minHeight: '7rem' }}
                          />
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => setEditingJobSections(p => ({ ...p, [field.key]: false }))}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-primary-700 hover:bg-primary-50 transition-colors">
                              <Check size={13} /> 완료
                            </button>
                          </div>
                        </div>
                      ) : isTrulyEmpty ? (
                        <button
                          onClick={() => setEditingJobSections(p => ({ ...p, [field.key]: true }))}
                          className="w-full py-3 border-2 border-dashed border-primary-200 rounded-xl text-[13px] font-medium text-primary-500 hover:bg-primary-50/60 transition-colors flex items-center justify-center gap-2">
                          <PenLine size={14} /> 빈칸 채우기
                        </button>
                      ) : isDraft ? (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3">
                          <p className="text-[11px] text-blue-400 font-medium mb-1.5">AI 초안 — 수정해서 완성해보세요</p>
                          <p className="text-[13px] text-bluewood-500 leading-[1.85] whitespace-pre-wrap">{val.replace(/^\[작성 필요\]\s*/,'').trim()}</p>
                          {!viewOnly && (
                            <button onClick={() => setEditingJobSections(p => ({ ...p, [field.key]: true }))}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                              <PenLine size={11} /> 수정하기
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-[13px] text-bluewood-700 leading-[1.85] whitespace-pre-wrap">{val}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ╔══════════════════════════════════════════════╗
         ║  하단: 상세 경험 정리 — 항상 펼쳐진 편집모드  ║
         ╚══════════════════════════════════════════════╝ */}
      <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-extrabold text-bluewood-900">상세 경험 정리</h2>
            <span className="text-[12px] text-bluewood-300 font-medium">{filledCount}/7 완성</span>
          </div>
          <div className="flex items-center gap-2">
          </div>
        </div>

        {/* 하이라이트 범례 — 하이라이트 있으면 항상 표시 */}
        {(structured.highlights || []).length > 0 && (
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
            const isTrulyEmpty = !value.trim();
            const isDraft = !isTrulyEmpty && value.trim().startsWith('[작성 필요]');
            const isEmpty = isTrulyEmpty;
            const isEditing = editingSections[key];
            const field = FRAMEWORKS.STRUCTURED.fields.find(f => f.key === key);
            const draftText = isDraft ? value.replace(/^\[작성 필요\]\s*/,'').trim() : '';

            return (
              <div key={key} className="group">
                {/* 섹션 헤더 바 — 완성 시 brief glow */}
                <div className={`flex items-center gap-4 px-6 py-3 transition-colors duration-300 ${
                  flashedSection === key ? 'bg-caribbean-50/60 animate-section-glow' : 'bg-surface-50/30'
                }`}>
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
                    ) : isDraft ? (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded text-[10px] font-semibold">초안</span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-caribbean-50 text-caribbean-600 rounded text-[10px] font-semibold transition-transform duration-300 ${flashedSection === key ? 'scale-110' : 'scale-100'}`}>
                        {flashedSection === key && (
                          <svg width="9" height="7" viewBox="0 0 9 7" fill="none" className="animate-pop-in">
                            <path d="M1 3.5L3.5 6L8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        완료
                      </span>
                    )}
                    {!isEditing && !isEmpty && !viewOnly && (
                      <button onClick={() => handleStartEditing(key)}
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
                      <p className="text-[11px] text-primary-400 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 mb-3 leading-relaxed">
                        💡 <strong>{meta.subtitle}</strong><br />{field?.placeholder}
                      </p>
                      <textarea
                        ref={el => { sectionTextareaRefs.current[key] = el; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                        value={editedContent[key] || ''}
                        onChange={e => { handleFieldChange(key, e.target.value); const t = e.target; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                        placeholder={field?.placeholder || '내용을 입력하세요'}
                        className={`w-full bg-white rounded-xl border border-surface-200 p-4 text-[13px] outline-none ${style.ring} focus:ring-2 transition-shadow resize-none overflow-hidden text-bluewood-800 placeholder-bluewood-300`}
                        style={{ minHeight: key === 'intro' ? '3rem' : '7rem' }}
                      />
                      {!(!editedContent[key]?.trim()) && (
                        <div className="flex justify-end mt-2">
                          <button onClick={() => handleStartEditing(key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${style.label} hover:bg-white/80 transition-colors`}>
                            <Check size={13} /> 완료
                          </button>
                        </div>
                      )}
                    </div>
                  ) : isEmpty ? (
                    <button onClick={() => handleStartEditing(key)}
                      className={`w-full py-3 border-2 border-dashed ${style.border} rounded-xl text-[13px] font-medium ${style.label} hover:bg-white/60 transition-colors flex items-center justify-center gap-2`}>
                      <PenLine size={14} /> 빈칸 채우기
                    </button>
                  ) : isDraft ? (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3">
                      <p className="text-[11px] text-blue-400 font-medium mb-1.5">AI 초안 — 수정해서 완성해보세요</p>
                      <p className="text-[13px] text-bluewood-500 leading-[1.85] whitespace-pre-wrap">{draftText}</p>
                      {!viewOnly && (
                        <button onClick={() => handleStartEditing(key)}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                          <PenLine size={11} /> 수정하기
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-[13px] text-bluewood-700 leading-[1.85] whitespace-pre-wrap">
                      <HighlightedText
                        text={value}
                        highlights={(structured.highlights || []).filter(h => h.field === key)}
                        keywords={editedKeywords}
                        showKeywordUnderline={true}
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

        </div>{/* end 메인 콘텐츠 */}

        {/* ── 우측: 기업 분석 사이드바 (숨김) ── */}
        <div className="w-[300px] flex-shrink-0 hidden">
          <div className="sticky top-5 space-y-3">
            {jobAnalysis ? (
              <JobAnalysisBadge
                analysis={jobAnalysis}
                onRemove={handleRemoveJobAnalysis}
              />
            ) : (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Building2 size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900">기업 분석</p>
                      <p className="text-[11px] text-blue-400">채용공고 URL을 입력하세요</p>
                    </div>
                  </div>

                  {showJobInput ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="url"
                          value={jobUrl}
                          onChange={e => setJobUrl(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleJobAnalyze()}
                          placeholder="https:// 채용공고 링크"
                          className="w-full pl-8 pr-3 py-2.5 text-xs border border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                      {jobError && (
                        <p className="text-[11px] text-red-500 flex items-center gap-1">
                          <X size={11} /> {jobError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleJobAnalyze}
                          disabled={analyzingJob || !jobUrl.trim()}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {analyzingJob ? (
                            <><Loader2 size={12} className="animate-spin" /> 분석 중...</>
                          ) : (
                            <><Sparkles size={12} /> 분석하기</>
                          )}
                        </button>
                        <button
                          onClick={() => { setShowJobInput(false); setJobUrl(''); setJobError(null); }}
                          className="px-3 py-2 text-gray-400 hover:text-gray-600 text-xs transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowJobInput(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Sparkles size={13} /> 채용공고 분석하기
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 분석 후 URL 변경 버튼 */}
            {jobAnalysis && !showJobInput && (
              <button
                onClick={() => setShowJobInput(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-blue-500 hover:text-blue-700 border border-blue-200 rounded-xl bg-white hover:bg-blue-50 transition-colors"
              >
                <Globe size={11} /> 다른 공고로 변경
              </button>
            )}
            {jobAnalysis && showJobInput && (
              <div className="bg-white border border-blue-200 rounded-2xl p-4 space-y-2">
                <p className="text-[11px] font-semibold text-blue-700">새 채용공고로 변경</p>
                <div className="relative">
                  <Globe size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={jobUrl}
                    onChange={e => setJobUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleJobAnalyze()}
                    placeholder="https:// 채용공고 링크"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                {jobError && (
                  <p className="text-[11px] text-red-500 flex items-center gap-1">
                    <X size={11} /> {jobError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleJobAnalyze}
                    disabled={analyzingJob || !jobUrl.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {analyzingJob ? <><Loader2 size={11} className="animate-spin" /> 분석 중...</> : <><Sparkles size={11} /> 분석</>}
                  </button>
                  <button
                    onClick={() => { setShowJobInput(false); setJobUrl(''); setJobError(null); }}
                    className="px-2.5 py-1.5 text-gray-400 hover:text-gray-600 text-xs border border-gray-200 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>{/* end 기업분석 사이드바 */}

      </div>{/* end flex gap-5 */}

    </div>
    </div>

      {/* 오른쪽: 프로젝트 타임라인 네비게이터 (고정, 접기/펼치기) — scale 래퍼 바깥 */}
      <div className="hidden lg:block fixed right-0 top-20 z-30">
        <ProjectTimeline experiences={experiences} currentId={id} />
      </div>

      {/* ── 포트폴리오 내보내기 모달 ── */}
      {showExportPanel && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6" onClick={() => setShowExportPanel(false)}>
          <div
            className="w-full max-w-[1160px] h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-surface-200"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-7 py-4 border-b border-surface-200 flex-shrink-0">
              <div>
                <h3 className="text-[15px] font-extrabold text-bluewood-900">포트폴리오 미리보기</h3>
                <p className="text-[12px] text-bluewood-400 mt-0.5">섹션을 구성하고 저장하면 포트폴리오에서 불러올 수 있어요</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-bluewood-400">{exportOrder.filter(k => exportEnabled[k] !== false).length}개 섹션 선택됨</span>
                <button
                  onClick={() => setShowExportPanel(false)}
                  className="text-[13px] text-bluewood-400 hover:text-bluewood-700 px-3 py-1.5 rounded-lg hover:bg-surface-100 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>

            {/* 본문 */}
            <div className="flex flex-1 min-h-0">

              {/* 왼쪽: 섹션 구성 */}
              <div className="w-[300px] flex-shrink-0 bg-surface-50 border-r border-surface-200 flex flex-col">
                <div className="px-5 pt-4 pb-2 flex-shrink-0">
                  <p className="text-[11px] font-bold text-bluewood-400 uppercase tracking-widest">섹션 구성</p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
                  {exportOrder.map((key) => {
                    const isJob = (JOB_SPECIFIC_FIELDS[jobCategory] || []).find(s => s.key === key);
                    const isSect = SECTION_KEYS.includes(key);
                    if (!isJob && !isSect) return null;
                    const label = isJob ? isJob.label : SECTION_META[key].label;
                    const num = isSect ? SECTION_META[key].num : null;
                    const enabled = exportEnabled[key] !== false;
                    const globalIdx = exportOrder.indexOf(key);
                    const hasContent = isJob
                      ? !!(editedJobSpecific[key] || '').trim()
                      : !!(editedContent[key] || '').trim();

                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all cursor-default ${
                          enabled
                            ? isJob
                              ? 'bg-caribbean-50 border-caribbean-200'
                              : 'bg-white border-surface-200 hover:border-primary-300'
                            : 'bg-transparent border-transparent opacity-40'
                        }`}
                      >
                        {/* 체크박스 토글 */}
                        <button
                          onClick={() => setExportEnabled(p => ({ ...p, [key]: !enabled }))}
                          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            enabled
                              ? isJob ? 'bg-caribbean-500 border-caribbean-500' : 'bg-primary-500 border-primary-500'
                              : 'bg-white border-surface-300'
                          }`}
                        >
                          {enabled && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                        </button>

                        {/* 번호 / 직군 마커 */}
                        {num ? (
                          <span className="flex-shrink-0 text-[11px] font-bold text-bluewood-400 w-5 text-right">{num}</span>
                        ) : (
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-caribbean-400" />
                        )}

                        {/* 라벨 */}
                        <span className={`flex-1 text-[13px] font-medium leading-tight ${
                          enabled ? 'text-bluewood-800' : 'text-bluewood-300'
                        }`}>{label}</span>

                        {/* 빈칸 경고 */}
                        {!hasContent && enabled && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0">빈칸</span>
                        )}

                        {/* 순서 버튼 */}
                        <div className="flex flex-col flex-shrink-0">
                          <button
                            onClick={() => moveExportSection(globalIdx, -1)}
                            disabled={globalIdx === 0}
                            className="text-[11px] text-bluewood-400 hover:text-bluewood-700 disabled:opacity-20 leading-none px-1 py-0.5"
                          >▲</button>
                          <button
                            onClick={() => moveExportSection(globalIdx, 1)}
                            disabled={globalIdx === exportOrder.length - 1}
                            className="text-[11px] text-bluewood-400 hover:text-bluewood-700 disabled:opacity-20 leading-none px-1 py-0.5"
                          >▼</button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 하단 버튼 */}
                <div className="px-4 py-4 border-t border-surface-200 flex-shrink-0 space-y-2">
                  <button
                    onClick={handleSaveExportConfig}
                    className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-[14px] font-bold transition-colors"
                  >
                    구성 저장하기
                  </button>
                  <button
                    onClick={() => setShowExportPanel(false)}
                    className="w-full py-2 text-[13px] text-bluewood-400 hover:text-bluewood-700 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>

              {/* 오른쪽: Notion 스타일 미리보기 */}
              <div className="flex-1 bg-white overflow-y-auto">

                {/* 커버 이미지 영역 */}
                <div className={`relative w-full group ${exportCoverImg ? 'h-52' : 'h-14'}`}>
                  {exportCoverImg ? (
                    <>
                      <img src={exportCoverImg} alt="cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <label className="cursor-pointer px-3 py-1.5 bg-white/90 text-[12px] font-semibold text-bluewood-700 rounded-lg hover:bg-white transition-colors">
                          변경
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => setExportCoverImg(ev.target.result);
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                        <button
                          onClick={() => setExportCoverImg(null)}
                          className="px-3 py-1.5 bg-white/90 text-[12px] font-semibold text-red-600 rounded-lg hover:bg-white transition-colors"
                        >
                          제거
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center px-14">
                      <label className="cursor-pointer text-[12px] text-bluewood-300 hover:text-bluewood-500 transition-colors">
                        + 커버 이미지 추가
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => setExportCoverImg(ev.target.result);
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                    </div>
                  )}
                </div>

                {/* 문서 본문 */}
                <div className="max-w-[680px] mx-auto px-14 pb-16 pt-8">
                  {/* 제목 */}
                  <h1 className="text-[34px] font-extrabold text-bluewood-900 leading-tight mb-8">
                    {editedTitle || '프로젝트 제목'}
                  </h1>

                  {/* 프로퍼티 */}
                  <div className="mb-8 space-y-2.5 border-b border-surface-200 pb-6">
                    {editedOverview.duration && (
                      <div className="flex items-center gap-4">
                        <span className="w-16 text-[12px] text-bluewood-400 flex-shrink-0">기간</span>
                        <span className="text-[13px] text-bluewood-700">{editedOverview.duration}</span>
                      </div>
                    )}
                    {editedOverview.role && (
                      <div className="flex items-center gap-4">
                        <span className="w-16 text-[12px] text-bluewood-400 flex-shrink-0">역할</span>
                        <span className="text-[13px] text-bluewood-700">{editedOverview.role}</span>
                      </div>
                    )}
                    {editedOverview.techStack?.length > 0 && (
                      <div className="flex items-start gap-4">
                        <span className="w-16 text-[12px] text-bluewood-400 flex-shrink-0 mt-0.5">기술</span>
                        <div className="flex flex-wrap gap-1.5">
                          {editedOverview.techStack.map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-surface-100 text-bluewood-600 rounded text-[12px]">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {editedKeywords.length > 0 && (
                      <div className="flex items-start gap-4">
                        <span className="w-16 text-[12px] text-bluewood-400 flex-shrink-0 mt-0.5">키워드</span>
                        <div className="flex flex-wrap gap-1.5">
                          {editedKeywords.slice(0, 6).map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-500 rounded text-[12px] font-medium">
                              {typeof kw === 'string' ? kw : kw?.name || kw?.keyword || ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {editedOverview.goal && (
                      <div className="flex items-start gap-4">
                        <span className="w-16 text-[12px] text-bluewood-400 flex-shrink-0 mt-0.5">목표</span>
                        <span className="text-[13px] text-bluewood-700 leading-relaxed">{editedOverview.goal}</span>
                      </div>
                    )}
                  </div>

                  {/* 핵심 경험 슬라이드 */}
                  <PreviewKeySlides keyExperiences={editedKeyExperiences} />

                  {/* 섹션 본문 */}
                  <div className="space-y-8">
                    {exportOrder
                      .filter(k => exportEnabled[k] !== false)
                      .map(key => {
                        const isJob = (JOB_SPECIFIC_FIELDS[jobCategory] || []).find(s => s.key === key);
                        const isSect = SECTION_KEYS.includes(key);
                        const label = isJob ? isJob.label : (isSect ? SECTION_META[key].label : key);
                        const content = isJob
                          ? (editedJobSpecific[key] || '')
                          : (editedContent[key] || '');
                        if (!content.trim()) return null;
                        const displayContent = content.trim().startsWith('[작성 필요]')
                          ? content.replace(/^\[작성 필요\]\s*/, '')
                          : content;

                        return (
                          <div key={key}>
                            <h2 className={`text-[12px] font-bold uppercase tracking-widest mb-3 pb-2 border-b ${
                              isJob
                                ? 'text-primary-600 border-primary-100'
                                : 'text-bluewood-400 border-surface-200'
                            }`}>
                              {label}{isJob ? ' · 직군특화' : ''}
                            </h2>
                            <p className="text-[14px] text-bluewood-700 leading-[1.9] whitespace-pre-wrap">
                              {displayContent}
                            </p>
                          </div>
                        );
                      })}

                    {exportOrder.filter(k => exportEnabled[k] !== false).every(k => {
                      const isJob = (JOB_SPECIFIC_FIELDS[jobCategory] || []).find(s => s.key === k);
                      const content = isJob ? (editedJobSpecific[k] || '') : (editedContent[k] || '');
                      return !content.trim();
                    }) && (
                      <p className="text-center text-bluewood-300 text-[14px] py-16">선택된 섹션에 내용이 없습니다</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ── 프로젝트 타임라인 네비게이터 ── */
function parsePeriodStr(exp) {
  const period = exp.period || exp.structuredResult?.projectOverview?.duration || '';
  const dateRegex = /(\d{4})[.\-/](\d{1,2})(?:[.\-/](\d{1,2}))?/g;
  const matches = [...period.matchAll(dateRegex)];
  if (matches.length >= 1) {
    const y = matches[0][1];
    const m = String(matches[0][2]).padStart(2, '0');
    if (matches.length >= 2) {
      const y2 = matches[1][1];
      const m2 = String(matches[1][2]).padStart(2, '0');
      return `${y}.${m} – ${y2}.${m2}`;
    }
    return `${y}.${m}`;
  }
  return '';
}

function ProjectTimeline({ experiences, currentId }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  if (!experiences || experiences.length === 0) return null;

  return (
    <div className={`transition-all duration-300 ease-in-out ${expanded ? 'w-[220px]' : 'w-[52px]'}`}>
      <div className={`bg-white/90 backdrop-blur-sm border-l border-surface-200 shadow-sm h-[calc(100vh-80px)] overflow-y-auto py-4 ${expanded ? 'px-3' : 'px-1.5'}`}>
        {/* 토글 버튼 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center justify-center mb-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
            expanded ? 'text-primary-600 hover:bg-primary-50' : 'text-bluewood-400 hover:bg-surface-100'
          }`}
        >
          {expanded ? '▶' : '◀'}
        </button>

        <div className="relative">
          {/* 세로 연결선 */}
          <div className={`absolute ${expanded ? 'left-[18px]' : 'left-[17px]'} top-4 bottom-4 w-[2px] bg-surface-100`} />
          <div className="space-y-1">
            {experiences.map((exp, idx) => {
              const isCurrent = exp.id === currentId;
              const title = exp.title ? String(exp.title).replace(/\*\*/g, '') : `P${idx + 1}`;
              const periodLabel = parsePeriodStr(exp);

              return (
                <button
                  key={exp.id}
                  onClick={() => { if (!isCurrent) navigate(`/app/experience/structured/${exp.id}?view=true`); }}
                  title={expanded ? undefined : title}
                  className={`relative w-full flex items-center gap-2.5 rounded-xl text-left transition-all duration-200 ${
                    expanded ? 'px-2 py-3' : 'px-0 py-2 justify-center'
                  } ${
                    isCurrent
                      ? expanded ? 'bg-primary-50/80' : ''
                      : 'hover:bg-surface-50 cursor-pointer'
                  }`}
                >
                  {/* 활성 바 */}
                  {isCurrent && expanded && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary-500 rounded-r-full" />
                  )}
                  {/* 번호 원 */}
                  <span className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-200 ${
                    isCurrent
                      ? 'bg-primary-500 text-white shadow-md shadow-primary-200/50'
                      : 'bg-surface-100 border-2 border-surface-200 text-bluewood-400'
                  }`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {/* 텍스트 (펼쳐진 상태에만) */}
                  {expanded && (
                    <div className="min-w-0 flex-1">
                      <p className={`text-[12px] leading-tight truncate transition-colors duration-200 ${
                        isCurrent ? 'text-primary-700 font-bold' : 'text-bluewood-600 font-medium'
                      }`}>
                        {title}
                      </p>
                      {periodLabel && (
                        <p className={`text-[9px] mt-0.5 ${isCurrent ? 'text-primary-400' : 'text-bluewood-300'}`}>
                          {periodLabel}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
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

function SentenceKwSpan({ text, color, keywords }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const spanRef = useRef(null);

  const handleEnter = () => {
    setVisible(true);
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      setPos({ left: rect.left + rect.width / 2, top: rect.top - 8 });
    }
  };

  return (
    <span className="relative inline">
      <span
        ref={spanRef}
        className="cursor-help"
        style={{ borderBottom: `2px solid ${color}`, paddingBottom: '1px' }}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setVisible(false)}
      >{text}</span>
      {visible && createPortal(
        <span
          className="fixed z-[9999] whitespace-normal max-w-[240px] bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl pointer-events-none flex flex-col gap-2"
          style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -100%)' }}
        >
          <span className="text-[11px] font-semibold text-gray-100">역량 키워드</span>
          <span className="text-[10px] text-gray-400 leading-relaxed">이 경험 서술 전체를 AI가 분석해 도출한 역량 키워드예요. 밑줄 친 문장에서 해당 역량이 드러납니다.</span>
          <span className="flex flex-wrap gap-1 border-t border-white/10 pt-1.5">
            {keywords.map(k => (
              <span key={k} className="px-1.5 py-0.5 rounded-md text-[10px] leading-tight bg-white/20">{k}</span>
            ))}
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-2.5 h-2.5 bg-gray-900 rotate-45" />
        </span>,
        document.body
      )}
    </span>
  );
}

function HighlightSpan({ text, type, keywords }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const spanRef = useRef(null);
  const color = highlightColors[type] || highlightColors.core;

  const handleEnter = () => {
    setVisible(true);
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      setPos({ left: rect.left + rect.width / 2, top: rect.top - 8 });
    }
  };

  return (
    <span className="relative inline">
      <span
        ref={spanRef}
        className="cursor-help font-medium transition-colors"
        style={{
          borderBottom: `2.5px solid ${color.underline}`,
          paddingBottom: '1px',
          backgroundColor: `${color.underline}10`,
        }}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setVisible(false)}
      >{text}</span>
      {visible && createPortal(
        <span
          className="fixed z-[9999] whitespace-normal max-w-[260px] bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl pointer-events-none flex flex-col gap-2"
          style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -100%)' }}
        >
          <span className="flex items-center gap-1.5 font-bold text-[12px]">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
            {color.label}
          </span>
          <span className="text-gray-300 text-[11px] leading-relaxed">{color.desc}</span>
          {keywords.length > 0 && (
            <span className="flex flex-wrap gap-1 border-t border-white/10 pt-1.5">
              {keywords.map(k => (
                <span key={k} className="px-1.5 py-0.5 bg-white/20 rounded-md text-[10px] leading-tight">{k}</span>
              ))}
            </span>
          )}
          {/* 말풍선 꼬리 */}
          <span className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-2.5 h-2.5 bg-gray-900 rotate-45" />
        </span>,
        document.body
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
  const cleanText = stripMarkdown(text);

  /* 1단계: 구조화 하이라이트 위치 계산 */
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

  /* 2단계: 하이라이트 구절 → 문장 단위로 확장 */
  const expandToSentence = (pos, len) => {
    let start = pos;
    while (start > 0 && !/[.!?\n]/.test(cleanText[start - 1])) start--;
    while (start < pos && /\s/.test(cleanText[start])) start++;
    let end = pos + len;
    while (end < cleanText.length && !/[.!?\n]/.test(cleanText[end])) end++;
    if (end < cleanText.length) end++;
    return { start, end };
  };

  // 문장 범위로 확장 후 겹치는 범위 병합
  const typePriority = { core: 0, derived: 1, growth: 2 };
  const sentenceRanges = positioned.map(h => ({ ...h, ...expandToSentence(h.pos, h.len) }));
  const merged = [];
  for (const r of sentenceRanges) {
    if (merged.length > 0 && r.start <= merged[merged.length - 1].end) {
      const last = merged[merged.length - 1];
      last.end = Math.max(last.end, r.end);
      last.keywords = [...new Set([...last.keywords, ...(r.keywords || [])])];
      if ((typePriority[r.type] ?? 99) < (typePriority[last.type] ?? 99)) last.type = r.type;
    } else {
      merged.push({ ...r, keywords: [...(r.keywords || [])] });
    }
  }

  // parts 구성 (문장 단위 하이라이트 적용)
  let parts = [];
  if (merged.length > 0) {
    let lastIndex = 0;
    for (const r of merged) {
      if (r.start < lastIndex) continue;
      if (r.start > lastIndex) parts.push({ text: cleanText.slice(lastIndex, r.start), type: null, keywords: [] });
      parts.push({ text: cleanText.slice(r.start, r.end), type: r.type || 'core', keywords: r.keywords });
      lastIndex = r.end;
    }
    if (lastIndex < cleanText.length) parts.push({ text: cleanText.slice(lastIndex), type: null, keywords: [] });
  } else {
    parts = [{ text: cleanText, type: null, keywords: [] }];
  }

  /* 3단계: 역량 키워드 밑줄 */
  const kwMap = new Map();
  if (showKeywordUnderline && keywords.length > 0) {
    keywords.forEach((kw, i) => {
      kwMap.set(kw.toLowerCase(), KEYWORD_COLORS[i % KEYWORD_COLORS.length]);
    });
  }

  /* 키워드 밑줄 적용 함수: 문장 단위로 확장 후 밑줄 + 말풍선 */
  const applyKeywordUnderlines = (str) => {
    if (kwMap.size === 0) return str;

    // 키워드 위치 수집
    const matches = [];
    for (const [kw, color] of kwMap) {
      const lower = str.toLowerCase();
      let idx = 0;
      while (true) {
        const found = lower.indexOf(kw, idx);
        if (found === -1) break;
        matches.push({ pos: found, len: kw.length, kw, color });
        idx = found + 1;
      }
    }
    if (matches.length === 0) return str;
    matches.sort((a, b) => a.pos - b.pos);

    // 문장 단위로 확장
    const expandSent = (pos, len) => {
      let start = pos;
      while (start > 0 && !/[.!?\n]/.test(str[start - 1])) start--;
      while (start < pos && /\s/.test(str[start])) start++;
      let end = pos + len;
      while (end < str.length && !/[.!?\n]/.test(str[end])) end++;
      if (end < str.length) end++;
      return { start, end };
    };

    // 겹치는 문장 범위 병합
    const sentRanges = matches.map(m => ({ ...m, ...expandSent(m.pos, m.len) }));
    const merged = [];
    for (const r of sentRanges) {
      if (merged.length > 0 && r.start <= merged[merged.length - 1].end) {
        const last = merged[merged.length - 1];
        last.end = Math.max(last.end, r.end);
        if (!last.keywords.includes(r.kw)) last.keywords.push(r.kw);
      } else {
        merged.push({ ...r, keywords: [r.kw] });
      }
    }

    // 결과 조합
    const result = [];
    let lastIdx = 0;
    for (const r of merged) {
      if (r.start > lastIdx) result.push(str.slice(lastIdx, r.start));
      result.push(
        <SentenceKwSpan key={`skw-${r.start}`} text={str.slice(r.start, r.end)} color={r.color} keywords={r.keywords} />
      );
      lastIdx = r.end;
    }
    if (lastIdx < str.length) result.push(str.slice(lastIdx));
    return result;
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
