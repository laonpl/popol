import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, Loader2, ImagePlus, X, Image } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import useExperienceStore, { FRAMEWORKS, JOB_CATEGORIES, JOB_SPECIFIC_FIELDS } from '../../stores/experienceStore';
import toast from 'react-hot-toast';

export default function ExperienceEditor() {
  const { id, framework: paramFramework } = useParams();
  const isNew = id === undefined;
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createExperience, updateExperience, analyzeExperience } = useExperienceStore();
  const imageInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [framework, setFramework] = useState(paramFramework || 'STRUCTURED');
  const [jobCategory, setJobCategory] = useState('common');
  const [content, setContent] = useState({});
  const [images, setImages] = useState([]); // [{ url, storagePath, name }]
  const [imageSizes, setImageSizes] = useState({}); // { [index]: widthPercent }
  const imageSizesRef = useRef(imageSizes);
  useEffect(() => {
    imageSizesRef.current = imageSizes;
  }, [imageSizes]);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [currentId, setCurrentId] = useState(id); // 신규 저장 후 ID 추적

  const fw = FRAMEWORKS[framework];

  // Load existing experience
  useEffect(() => {
    if (!isNew && id) {
      loadExperience(id);
    }
  }, [id]);

  const loadExperience = async (expId) => {
    try {
      const docSnap = await getDoc(doc(db, 'experiences', expId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTitle(data.title || '');
        setFramework(data.framework || 'STAR');
        setJobCategory(data.jobCategory || 'common');
        setContent(data.content || {});
        setImages(data.images || []);
        setImageSizes(data.imageSizes || {});
      }
    } catch (error) {
      toast.error('경험 데이터를 불러오지 못했습니다');
    }
    setLoading(false);
  };

  const handleFieldChange = (key, value) => {
    setContent(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      if (isNew && !currentId) {
        const newId = await createExperience(user.uid, { title, framework, jobCategory, content, images, imageSizes });
        setCurrentId(newId);
        toast.success('경험이 저장되었습니다!');
        navigate(`/app/experience/edit/${newId}`, { replace: true });
      } else {
        await updateExperience(currentId || id, { title, framework, jobCategory, content, images, imageSizes });
        toast.success('수정사항이 저장되었습니다');
      }
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
    setSaving(false);
  };

  const handleAnalyze = async () => {
    if (!title.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }
    setAnalyzing(true);
    try {
      let experienceId = currentId || id;
      if (!experienceId) {
        experienceId = await createExperience(user.uid, { title, framework, jobCategory, content, images, imageSizes });
        setCurrentId(experienceId);
      } else {
        await updateExperience(experienceId, { title, framework, jobCategory, content, images, imageSizes });
      }
      // 2단계: 저장 완료 후 AI 분석 호출
      const analysis = await analyzeExperience(experienceId);
      toast.success('AI 분석이 완료되었습니다!');
      navigate(`/app/experience/structured/${experienceId}`, { state: { analysis, title, framework, content } });
    } catch (error) {
      const serverMsg = error.response?.data?.error || error.response?.data?.detail;
      if (error.isRateLimit) {
        toast.error(error.message);
      } else if (serverMsg) {
        toast.error(serverMsg);
      } else if (error.code === 'ECONNABORTED') {
        toast.error('AI 분석 시간이 초과되었습니다. 내용을 줄이고 다시 시도해주세요.');
      } else {
        toast.error('AI 분석에 실패했습니다. 다시 시도해주세요.');
      }
    }
    setAnalyzing(false);
  };

  // 이미지 → Base64 변환 (Canvas로 리사이즈 + 압축)
  const resizeToBase64 = (file, maxPx = 1200, quality = 0.75) =>
    new Promise((resolve, reject) => {
      const img = new Image();
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

  // 이미지 업로드 핸들러
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (images.length + files.length > 5) {
      toast.error('사진은 최대 5장까지 업로드할 수 있습니다');
      e.target.value = '';
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}은(는) 이미지 파일이 아닙니다`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}의 크기가 10MB를 초과합니다`);
        continue;
      }

      setUploadingImage(true);
      try {
        let docId = currentId || id;
        if (!docId) {
          if (!title.trim()) {
            toast.error('사진 업로드 전에 제목을 먼저 입력해주세요');
            setUploadingImage(false);
            e.target.value = '';
            return;
          }
          docId = await createExperience(user.uid, { title, framework, jobCategory, content, images: [], imageSizes: {} });
          setCurrentId(docId);
          navigate(`/app/experience/edit/${docId}`, { replace: true });
        }

        const base64 = await resizeToBase64(file);
        const newImage = { url: base64, name: file.name };
        const updatedImages = [...images, newImage];
        setImages(updatedImages);
        await updateExperience(docId, { images: updatedImages, imageSizes });
        toast.success(`${file.name} 업로드 완료`);
      } catch (err) {
        console.error('이미지 업로드 실패:', err);
        toast.error(`${file.name} 업로드에 실패했습니다`);
      }
      setUploadingImage(false);
    }
    e.target.value = '';
  };

  // 이미지 삭제 핸들러
  const handleImageDelete = async (index) => {
    const updatedImages = images.filter((_, i) => i !== index);
    // 삭제된 인덱스 이후는 재매핑
    const updatedSizes = {};
    Object.entries(imageSizes).forEach(([k, v]) => {
      const ki = Number(k);
      if (ki < index) updatedSizes[ki] = v;
      else if (ki > index) updatedSizes[ki - 1] = v;
    });
    setImages(updatedImages);
    setImageSizes(updatedSizes);
    const docId = currentId || id;
    if (docId) {
      try {
        await updateExperience(docId, { images: updatedImages, imageSizes: updatedSizes });
      } catch (err) {
        console.error('이미지 목록 저장 실패:', err);
      }
    }
  };

  // 이미지 리사이즉 핸들러 (포트폴리오와 동일한 UX)
  const makeResizeHandler = (index) => (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const container = e.currentTarget.closest('[data-img-wrap]');
    const startW = container?.offsetWidth || 200;
    const parentW = container?.parentElement?.offsetWidth || 600;

    const onMove = (mv) => {
      const delta = mv.clientX - startX;
      const newW = Math.max(80, Math.min(parentW, startW + delta));
      const pct = Math.round((newW / parentW) * 100);
      setImageSizes(prev => ({ ...prev, [index]: pct }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // 리사이즈 후 저장
      const docId = currentId || id;
      if (docId) updateExperience(docId, { imageSizes: imageSizesRef.current }).catch(() => {});
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn max-w-3xl mx-auto">
      <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={16} /> 경험 목록으로
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-lg text-sm font-semibold">
            {fw?.name || framework}
          </span>
          {!isNew && (
            <span className="text-xs text-gray-400">ID: {id}</span>
          )}
        </div>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="경험 제목을 입력하세요 (예: 동아리 프로젝트 리더 경험)"
          className="w-full text-xl font-bold outline-none placeholder-gray-300 border-b border-surface-200 pb-3"
        />
      </div>

      {/* 직군 선택 */}
      <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-700">직군 선택</h3>
            <p className="text-xs text-gray-400 mt-0.5">선택한 직군에 맞는 특화 섹션이 추가됩니다</p>
          </div>
          {jobCategory && jobCategory !== 'common' && (
            <span className="px-2.5 py-1 bg-primary-50 text-primary-600 rounded-lg text-xs font-medium border border-primary-100">
              {JOB_CATEGORIES.flatMap(g => g.items).find(i => i.value === jobCategory)?.label || jobCategory}
            </span>
          )}
        </div>
        <div className="space-y-4">
          {JOB_CATEGORIES.map(group => (
            <div key={group.group}>
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-gray-300">{group.group}</p>
              <div className="flex flex-wrap gap-2">
                {group.items.map(opt => {
                  const selected = jobCategory === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setJobCategory(selected ? 'common' : opt.value)}
                      title={opt.description}
                      className={`inline-flex flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                        selected
                          ? 'border-primary-400 bg-primary-500 text-white shadow-sm'
                          : 'border-surface-200 bg-white text-gray-600 hover:border-primary-200 hover:bg-primary-50/40'
                      }`}
                    >
                      <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                      <span className={`text-[10px] leading-snug line-clamp-1 ${selected ? 'text-primary-100' : 'text-gray-400'}`}>{opt.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 필수 7개 섹션 (공통) ── */}
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-[10.5px] font-bold uppercase tracking-widest text-gray-300">필수 섹션</span>
        <div className="flex-1 h-px bg-surface-100" />
      </div>
      <div className="space-y-4 mb-6">
        {fw?.fields.map(field => (
          <div key={field.key} className={`rounded-2xl border p-6 ${field.color}`}>
            <label className="block text-sm font-bold mb-1 text-gray-700">
              {field.label}
            </label>
            {field.subtitle && (
              <p className="text-xs text-gray-400 mb-3">{field.subtitle}</p>
            )}
            <textarea
              value={content[field.key] || ''}
              onChange={e => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={field.key === 'period' ? 1 : 5}
              className="w-full bg-white/70 rounded-xl border border-white/50 p-4 text-sm outline-none focus:ring-2 focus:ring-primary-200 transition-shadow resize-y"
            />
            {content[field.key] && (
              <p className="text-xs text-gray-400 mt-2 text-right">
                {content[field.key].length}자
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── 직군별 특화 섹션 ── */}
      {JOB_SPECIFIC_FIELDS[jobCategory]?.length > 0 && (
        <>
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="text-[10.5px] font-bold uppercase tracking-widest text-primary-400">
              {JOB_CATEGORIES.flatMap(g => g.items).find(i => i.value === jobCategory)?.label} 특화 섹션
            </span>
            <div className="flex-1 h-px bg-primary-100" />
          </div>
          <div className="space-y-4 mb-6">
            {JOB_SPECIFIC_FIELDS[jobCategory].map(field => (
              <div key={field.key} className={`rounded-2xl border p-6 ${field.color}`}>
                <label className="block text-sm font-bold mb-1 text-gray-700">
                  {field.label}
                </label>
                {field.subtitle && (
                  <p className="text-xs text-gray-400 mb-3">{field.subtitle}</p>
                )}
                <textarea
                  value={content[field.key] || ''}
                  onChange={e => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={5}
                  className="w-full bg-white/70 rounded-xl border border-white/50 p-4 text-sm outline-none focus:ring-2 focus:ring-primary-200 transition-shadow resize-y"
                />
                {content[field.key] && (
                  <p className="text-xs text-gray-400 mt-2 text-right">
                    {content[field.key].length}자
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 사진 업로드 섹션 */}
      <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Image size={18} className="text-gray-400" />
            <h3 className="text-sm font-bold text-gray-700">참고 사진</h3>
            <span className="text-xs text-gray-400">({images.length}/5)</span>
          </div>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage || images.length >= 5}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploadingImage ? (
              <><Loader2 size={13} className="animate-spin" /> 업로드 중...</>
            ) : (
              <><ImagePlus size={13} /> 사진 추가</>
            )}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {images.length === 0 ? (
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            className="w-full border-2 border-dashed border-surface-300 rounded-xl p-8 flex flex-col items-center gap-2 text-gray-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ImagePlus size={28} />
            <p className="text-sm font-medium">사진을 추가하세요</p>
            <p className="text-xs">JPG, PNG, WEBP · 최대 5MB · 최대 5장</p>
          </button>
        ) : (
          <div className="flex flex-wrap gap-3">
            {images.map((img, index) => {
              const widthPct = imageSizes[index];
              const style = widthPct
                ? { width: `${widthPct}%` }
                : { width: 'calc(33.33% - 8px)' };
              return (
                <div
                  key={index}
                  data-img-wrap="true"
                  className="relative group/rimg rounded-xl overflow-hidden border border-surface-200 flex-shrink-0"
                  style={style}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full object-cover block"
                    style={{ minHeight: '80px', maxHeight: '320px' }}
                  />
                  {/* 삭제 버튼 — 우상단 상시 표시 */}
                  <button
                    type="button"
                    onClick={() => handleImageDelete(index)}
                    className="absolute top-1.5 right-1.5 p-1 bg-white/95 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 shadow-sm border border-red-100 transition-all z-10"
                    title="사진 삭제"
                  >
                    <X size={12} />
                  </button>
                  {/* 리사이즈 핸들 (우측 가장자리) */}
                  <div
                    onMouseDown={makeResizeHandler(index)}
                    className="absolute top-1/2 right-0 -translate-y-1/2 w-3 h-10 cursor-ew-resize opacity-0 group-hover/rimg:opacity-100 transition-opacity z-10 rounded-l"
                    style={{ background: 'linear-gradient(to right, transparent, rgba(99,102,241,0.7))' }}
                    title="우측으로 드래그해서 크기 조정"
                  />
                  <p className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/40 text-white text-[10px] truncate">
                    {img.name}
                  </p>
                </div>
              );
            })}
            {images.length < 5 && (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="rounded-xl border-2 border-dashed border-surface-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 disabled:opacity-40 transition-all"
                style={{ width: 'calc(33.33% - 8px)', minHeight: '80px' }}
              >
                {uploadingImage ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <ImagePlus size={20} />
                    <span className="text-xs">추가</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 sticky bottom-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? '저장 중...' : '저장하기'}
        </button>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 transition-all"
        >
          {analyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {analyzing ? 'AI 분석 중...' : 'AI 분석하기'}
        </button>
      </div>
    </div>
  );
}
