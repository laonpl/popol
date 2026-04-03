import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import useExperienceStore, { FRAMEWORKS } from '../../stores/experienceStore';
import toast from 'react-hot-toast';

export default function ExperienceEditor() {
  const { id, framework: paramFramework } = useParams();
  const isNew = id === undefined;
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createExperience, updateExperience, analyzeExperience } = useExperienceStore();

  const [title, setTitle] = useState('');
  const [framework, setFramework] = useState(paramFramework || 'STAR');
  const [content, setContent] = useState({});
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(!isNew);

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
      if (isNew) {
        const newId = await createExperience(user.uid, { title, framework, content });
        toast.success('경험이 저장되었습니다!');
        navigate(`/app/experience/edit/${newId}`, { replace: true });
      } else {
        await updateExperience(id, { title, framework, content });
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
      let experienceId = id;
      if (isNew) {
        experienceId = await createExperience(user.uid, { title, framework, content });
      } else {
        await updateExperience(id, { title, framework, content });
      }
      const analysis = await analyzeExperience(experienceId);
      toast.success('AI 분석이 완료되었습니다!');
      navigate(`/app/experience/analysis/${experienceId}`, { state: { analysis, title, framework, content } });
    } catch (error) {
      toast.error('AI 분석에 실패했습니다. 다시 시도해주세요.');
    }
    setAnalyzing(false);
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
