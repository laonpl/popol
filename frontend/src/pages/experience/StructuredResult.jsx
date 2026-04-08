import { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Save, Loader2, HelpCircle, PenLine, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FRAMEWORKS } from '../../stores/experienceStore';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';

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
        updatedAt: new Date(),
      });
      setExperience(prev => ({ ...prev, structuredResult: updatedStructured, content: editedContent }));
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

        {/* Progress + Keywords */}
        <div className="flex items-center gap-4 mt-4">
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
        </div>
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
                        <p className="text-sm text-bluewood-700 leading-relaxed whitespace-pre-wrap">{value}</p>
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
