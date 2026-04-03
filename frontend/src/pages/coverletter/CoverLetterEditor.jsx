import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, Sparkles, Loader2,
  FolderOpen, ChevronDown, Link2, Upload, Download
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import useCoverLetterStore from '../../stores/coverLetterStore';
import ImportModal from '../../components/ImportModal';
import KeywordTag from '../../components/KeywordTag';
import { JobAnalysisBadge } from '../../components/JobLinkInput';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function CoverLetterEditor() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const { updateCoverLetter, generateDraft } = useCoverLetterStore();

  const [coverLetter, setCoverLetter] = useState(null);
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingIdx, setGeneratingIdx] = useState(null);
  const [expPickerIdx, setExpPickerIdx] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [exportFormat, setExportFormat] = useState('Notion');
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [clSnap, expSnapshot] = await Promise.all([
        getDoc(doc(db, 'coverLetters', id)),
        getDocs(query(collection(db, 'experiences'), where('userId', '==', user.uid)))
      ]);
      if (clSnap.exists()) {
        setCoverLetter({ id: clSnap.id, ...clSnap.data() });
      }
      setExperiences(expSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      toast.error('데이터를 불러오지 못했습니다');
    }
    setLoading(false);
  };

  const handleFieldChange = (field, value) => {
    setCoverLetter(prev => ({ ...prev, [field]: value }));
  };

  const handleQuestionChange = (index, field, value) => {
    const questions = [...(coverLetter.questions || [])];
    questions[index] = { ...questions[index], [field]: value };
    if (field === 'answer') {
      questions[index].wordCount = value.replace(/\s/g, '').length;
    }
    setCoverLetter(prev => ({ ...prev, questions }));
  };

  const addQuestion = () => {
    const questions = [...(coverLetter.questions || [])];
    questions.push({ question: '', answer: '', linkedExperienceIds: [], wordCount: 0, maxWordCount: 500 });
    setCoverLetter(prev => ({ ...prev, questions }));
  };

  const removeQuestion = (index) => {
    const questions = (coverLetter.questions || []).filter((_, i) => i !== index);
    setCoverLetter(prev => ({ ...prev, questions }));
  };

  const linkExperience = (questionIndex, experienceId) => {
    const questions = [...(coverLetter.questions || [])];
    const linked = questions[questionIndex].linkedExperienceIds || [];
    if (!linked.includes(experienceId)) {
      questions[questionIndex] = {
        ...questions[questionIndex],
        linkedExperienceIds: [...linked, experienceId],
      };
      setCoverLetter(prev => ({ ...prev, questions }));
    }
    setExpPickerIdx(null);
  };

  const unlinkExperience = (questionIndex, experienceId) => {
    const questions = [...(coverLetter.questions || [])];
    questions[questionIndex] = {
      ...questions[questionIndex],
      linkedExperienceIds: (questions[questionIndex].linkedExperienceIds || []).filter(id => id !== experienceId),
    };
    setCoverLetter(prev => ({ ...prev, questions }));
  };

  const handleGenerate = async (questionIndex) => {
    setGeneratingIdx(questionIndex);
    try {
      // Save first
      const { id: _id, ...data } = coverLetter;
      await updateCoverLetter(id, data);
      const draft = await generateDraft(id, questionIndex);
      handleQuestionChange(questionIndex, 'answer', draft);
      toast.success('AI 초안이 생성되었습니다!');
    } catch (error) {
      toast.error('AI 초안 생성에 실패했습니다');
    }
    setGeneratingIdx(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id: _id, ...data } = coverLetter;
      await updateCoverLetter(id, data);
      toast.success('저장되었습니다');
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
    setSaving(false);
  };

  const handleImportApply = ({ imported, structured }) => {
    const data = structured || {};
    const questions = [...(coverLetter.questions || [])];
    if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
      data.suggestedQuestions.forEach(q => {
        questions.push({ question: q, answer: '', linkedExperienceIds: [], wordCount: 0, maxWordCount: 500 });
      });
      toast.success(`${data.suggestedQuestions.length}개 문항이 추가되었습니다`);
    } else if (imported?.content) {
      questions.push({ question: '', answer: imported.content.substring(0, 3000), linkedExperienceIds: [], wordCount: imported.content.replace(/\s/g, '').length, maxWordCount: 500 });
      toast.success('내용이 새 문항으로 추가되었습니다');
    }
    setCoverLetter(prev => ({ ...prev, questions }));
  };

  const handleExportCL = async () => {
    setExporting(true);
    try {
      const exportData = {
        title: coverLetter.title || '',
        targetCompany: coverLetter.targetCompany || '',
        targetPosition: coverLetter.targetPosition || '',
        questions: (coverLetter.questions || []).map(q => ({
          question: q.question,
          answer: q.answer,
        })),
        summary: (coverLetter.questions || []).map(q => q.answer).join('\n\n'),
      };
      const formatMap = { 'PDF': 'pdf', 'Notion': 'notion', 'GitHub': 'github' };
      const endpoint = formatMap[exportFormat] || 'notion';
      const res = await api.post(`/export/${endpoint}`, { data: exportData }, { timeout: 60000 });
      if (res.data.content) {
        setExportResult({ content: res.data.content, format: res.data.format });
        toast.success(`${exportFormat} 형식으로 변환 완료!`);
      }
    } catch (error) {
      toast.error('내보내기에 실패했습니다');
    }
    setExporting(false);
  };

  const handleCopyExportCL = async () => {
    if (exportResult?.content) {
      await navigator.clipboard.writeText(exportResult.content);
      toast.success('클립보드에 복사되었습니다!');
    }
  };

  const handleDownloadExportCL = () => {
    if (!exportResult?.content) return;
    const ext = exportFormat === 'GitHub' ? 'md' : exportFormat === 'Notion' ? 'md' : 'txt';
    const blob = new Blob([exportResult.content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${coverLetter.title || '자기소개서'}.${ext}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  if (!coverLetter) {
    return <p className="text-gray-500 text-center py-20">자기소개서를 찾을 수 없습니다.</p>;
  }

  return (
    <div className="animate-fadeIn max-w-3xl mx-auto">
      <Link to="/app/coverletter" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={16} /> 목록으로
      </Link>

      {/* Meta Info */}
      <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <input
          value={coverLetter.title || ''}
          onChange={e => handleFieldChange('title', e.target.value)}
          className="w-full text-xl font-bold outline-none mb-4 border-b border-surface-200 pb-3"
          placeholder="자기소개서 제목"
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">지원 기업</label>
            <input
              value={coverLetter.targetCompany || ''}
              onChange={e => handleFieldChange('targetCompany', e.target.value)}
              placeholder="카카오"
              className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">지원 직무</label>
            <input
              value={coverLetter.targetPosition || ''}
              onChange={e => handleFieldChange('targetPosition', e.target.value)}
              placeholder="프론트엔드 개발자"
              className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
        </div>
        {/* 연결된 기업 공고 */}
        {coverLetter.jobAnalysis && (
          <div className="mt-4">
            <JobAnalysisBadge
              analysis={coverLetter.jobAnalysis}
              onRemove={() => handleFieldChange('jobAnalysis', null)}
            />
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-6 mb-6">
        {(coverLetter.questions || []).map((q, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-surface-200 p-6 animate-slideIn">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-primary-600">문항 {idx + 1}</span>
              <button onClick={() => removeQuestion(idx)} className="p-1.5 text-gray-300 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>

            {/* Question input */}
            <input
              value={q.question || ''}
              onChange={e => handleQuestionChange(idx, 'question', e.target.value)}
              placeholder="문항을 입력하세요 (예: 본인의 강점과 약점을 구체적인 사례를 들어 설명해주세요.)"
              className="w-full px-4 py-3 bg-surface-50 rounded-xl text-sm outline-none mb-4 border border-surface-200 focus:ring-2 focus:ring-primary-200"
            />

            {/* Linked experiences */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Link2 size={14} className="text-gray-400" />
                <span className="text-xs text-gray-400">연결된 경험</span>
                <div className="relative ml-auto">
                  <button
                    onClick={() => setExpPickerIdx(expPickerIdx === idx ? null : idx)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100"
                  >
                    <FolderOpen size={12} /> 경험 연결
                    <ChevronDown size={10} />
                  </button>
                  {expPickerIdx === idx && (
                    <div className="absolute top-full right-0 mt-1 w-72 bg-white border border-surface-200 rounded-xl shadow-lg z-10 max-h-48 overflow-auto">
                      {experiences.map(exp => (
                        <button
                          key={exp.id}
                          onClick={() => linkExperience(idx, exp.id)}
                          className="w-full text-left px-4 py-2.5 hover:bg-surface-50 border-b border-surface-100 last:border-0"
                        >
                          <p className="text-sm font-medium">{exp.title}</p>
                          <div className="flex gap-1 mt-1">
                            {(exp.keywords || []).slice(0, 2).map(k => (
                              <span key={k} className="text-[10px] px-1.5 py-0.5 bg-primary-50 text-primary-600 rounded">{k}</span>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(q.linkedExperienceIds || []).map(eid => {
                  const exp = experiences.find(e => e.id === eid);
                  return exp ? (
                    <span key={eid} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium">
                      {exp.title}
                      <button onClick={() => unlinkExperience(idx, eid)} className="hover:text-red-500">×</button>
                    </span>
                  ) : null;
                })}
              </div>
            </div>

            {/* Answer */}
            <textarea
              value={q.answer || ''}
              onChange={e => handleQuestionChange(idx, 'answer', e.target.value)}
              placeholder="답변을 작성하세요..."
              rows={8}
              className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-y"
            />

            {/* Footer */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <span className={`text-xs ${(q.wordCount || 0) > (q.maxWordCount || 500) ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                  {q.wordCount || 0} / {q.maxWordCount || 500}자 (공백 제외)
                </span>
                <input
                  type="number"
                  value={q.maxWordCount || 500}
                  onChange={e => handleQuestionChange(idx, 'maxWordCount', parseInt(e.target.value) || 500)}
                  className="w-16 px-2 py-1 border border-surface-200 rounded text-xs text-center outline-none"
                />
              </div>
              <button
                onClick={() => handleGenerate(idx)}
                disabled={generatingIdx === idx}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg text-xs font-medium hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 transition-all"
              >
                {generatingIdx === idx ? (
                  <><Loader2 size={14} className="animate-spin" /> 생성 중...</>
                ) : (
                  <><Sparkles size={14} /> AI 초안 생성</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Question */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={addQuestion}
          className="flex-1 flex items-center justify-center gap-2 py-4 border border-dashed border-surface-300 rounded-2xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
        >
          <Plus size={16} /> 문항 추가
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center justify-center gap-2 px-6 py-4 border border-dashed border-violet-300 rounded-2xl text-sm text-violet-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
        >
          <Upload size={16} /> 외부 데이터 불러오기
        </button>
      </div>

      {/* Save & Export Buttons */}
      <div className="flex items-center gap-3 sticky bottom-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? '저장 중...' : '저장하기'}
        </button>
        <select
          value={exportFormat}
          onChange={e => setExportFormat(e.target.value)}
          className="px-3 py-3.5 border border-surface-200 rounded-xl text-sm outline-none"
        >
          <option value="Notion">Notion</option>
          <option value="GitHub">GitHub</option>
          <option value="PDF">PDF</option>
        </select>
        <button
          onClick={handleExportCL}
          disabled={exporting}
          className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all"
        >
          {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          {exporting ? '변환 중...' : '내보내기'}
        </button>
      </div>

      {/* Export Result */}
      {exportResult && (
        <div className="mt-6 bg-white rounded-2xl border border-surface-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700">
              내보내기 결과 ({exportFormat})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleCopyExportCL}
                className="px-3 py-1.5 text-xs bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"
              >
                클립보드 복사
              </button>
              <button
                onClick={handleDownloadExportCL}
                className="px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
              >
                파일 다운로드
              </button>
              <button
                onClick={() => setExportResult(null)}
                className="px-3 py-1.5 text-xs bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-600 bg-surface-50 rounded-xl p-4 max-h-96 overflow-auto border border-surface-100">
            {exportResult.content}
          </pre>
        </div>
      )}

      {showImport && (
        <ImportModal
          targetType="coverletter"
          onClose={() => setShowImport(false)}
          onImport={handleImportApply}
        />
      )}
    </div>
  );
}
