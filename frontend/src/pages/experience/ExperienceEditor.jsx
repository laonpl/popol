import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, Loader2, ImagePlus, X, Image } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import useExperienceStore, { FRAMEWORKS } from '../../stores/experienceStore';
import api from '../../services/api';
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
  const [content, setContent] = useState({});
  const [images, setImages] = useState([]); // [{ url, storagePath, name }]
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
        setContent(data.content || {});
        setImages(data.images || []);
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
        const newId = await createExperience(user.uid, { title, framework, content, images });
        setCurrentId(newId);
        toast.success('경험이 저장되었습니다!');
        navigate(`/app/experience/edit/${newId}`, { replace: true });
      } else {
        await updateExperience(currentId || id, { title, framework, content, images });
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
        experienceId = await createExperience(user.uid, { title, framework, content, images });
        setCurrentId(experienceId);
      } else {
        await updateExperience(experienceId, { title, framework, content, images });
      }
      const analysis = await analyzeExperience(experienceId);
      toast.success('AI 분석이 완료되었습니다!');
      navigate(`/app/experience/structured/${experienceId}`, { state: { analysis, title, framework, content } });
    } catch (error) {
      toast.error('AI 분석에 실패했습니다. 다시 시도해주세요.');
    }
    setAnalyzing(false);
  };

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
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}의 크기가 5MB를 초과합니다`);
        continue;
      }

      setUploadingImage(true);
      try {
        // 신규 경험은 먼저 저장해서 ID 확보
        let docId = currentId || id;
        if (!docId) {
          if (!title.trim()) {
            toast.error('사진 업로드 전에 제목을 먼저 입력해주세요');
            setUploadingImage(false);
            e.target.value = '';
            return;
          }
          docId = await createExperience(user.uid, { title, framework, content, images: [] });
          setCurrentId(docId);
          navigate(`/app/experience/edit/${docId}`, { replace: true });
        }

        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `experiences/${user.uid}/${docId}/${timestamp}_${safeName}`;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('storagePath', storagePath);

        const { data } = await api.post('/upload/image', formData, {
          timeout: 60000,
        });

        const newImage = { url: data.url, storagePath: data.storagePath, name: file.name };
        const updatedImages = [...images, newImage];
        setImages(updatedImages);
        await updateExperience(docId, { images: updatedImages });
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
    const target = images[index];
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);

    // Storage에서 파일 삭제 (실패해도 UI는 반영)
    try {
      await api.delete('/upload/image', { data: { storagePath: target.storagePath } });
    } catch (err) {
      console.warn('Storage 파일 삭제 실패 (무시됨):', err.message);
    }

    const docId = currentId || id;
    if (docId) {
      try {
        await updateExperience(docId, { images: updatedImages });
      } catch (err) {
        console.error('이미지 목록 저장 실패:', err);
      }
    }
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

      {/* Framework Fields */}
      <div className="space-y-4 mb-6">
        {fw?.fields.map(field => (
          <div key={field.key} className={`rounded-2xl border p-6 ${field.color}`}>
            <label className="block text-sm font-bold mb-2 text-gray-700">
              {field.label}
            </label>
            <textarea
              value={content[field.key] || ''}
              onChange={e => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
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
          <div className="grid grid-cols-3 gap-3">
            {images.map((img, index) => (
              <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-surface-200">
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleImageDelete(index)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 bg-white/90 rounded-full text-red-500 hover:bg-white transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/40 text-white text-[10px] truncate">
                  {img.name}
                </p>
              </div>
            ))}
            {images.length < 5 && (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="aspect-square rounded-xl border-2 border-dashed border-surface-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 disabled:opacity-40 transition-all"
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
