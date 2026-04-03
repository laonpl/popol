import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, PenTool, Trash2, Edit, Upload, Download, Eye, X, Building2, ArrowRight, Loader2, FileText } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useCoverLetterStore from '../../stores/coverLetterStore';
import ImportModal from '../../components/ImportModal';
import DetailModal from '../../components/DetailModal';
import ExportModal from '../../components/ExportModal';
import JobLinkInput, { JobAnalysisBadge } from '../../components/JobLinkInput';

export default function CoverLetterHub() {
  const { user } = useAuthStore();
  const { coverLetters, fetchCoverLetters, createCoverLetter, deleteCoverLetter, loading } = useCoverLetterStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [showJobLink, setShowJobLink] = useState(false);
  const [jobAnalysis, setJobAnalysis] = useState(null);

  useEffect(() => {
    if (user?.uid) fetchCoverLetters(user.uid);
  }, [user?.uid]);

  const doCreate = async (analysis) => {
    setCreating(true);
    try {
      const data = { title: '새 자기소개서' };
      if (analysis) {
        data.targetCompany = analysis.company || '';
        data.targetPosition = analysis.position || '';
        data.jobAnalysis = analysis;
        // 공고에 자소서 문항이 있으면 자동 세팅
        if (analysis.applicationFormat?.questions?.length > 0) {
          data.title = `${analysis.company || '기업'} 자기소개서`;
          data.questions = analysis.applicationFormat.questions.map(q => ({
            question: q.question || '',
            answer: '',
            linkedExperienceIds: [],
            wordCount: 0,
            maxWordCount: q.maxLength || 500,
          }));
        }
      }
      const id = await createCoverLetter(user.uid, data);
      navigate(`/app/coverletter/edit/${id}`);
    } catch (error) {
      console.error(error);
    }
    setCreating(false);
    setShowJobLink(false);
    setJobAnalysis(null);
  };

  const handleCreate = () => {
    setShowJobLink(true);
  };

  const handleImport = async ({ imported, structured }) => {
    try {
      const data = structured || {};
      const questions = (data.suggestedQuestions || []).map(q => ({
        question: q,
        answer: '',
        linkedExperienceIds: [],
        wordCount: 0,
        maxWordCount: 500,
      }));
      if (questions.length === 0) {
        questions.push({ question: '', answer: imported?.content?.substring(0, 2000) || '', linkedExperienceIds: [], wordCount: 0, maxWordCount: 500 });
      }
      const id = await createCoverLetter(user.uid, {
        title: data.title || imported?.title || '임포트된 자기소개서',
        questions,
      });
      navigate(`/app/coverletter/edit/${id}`);
    } catch (error) {
      console.error('임포트 적용 실패:', error);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">자기소개서</h1>
          <p className="text-gray-500 mt-1">경험 DB와 연동하여 맞춤형 자소서를 작성하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-surface-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-surface-50 transition-colors"
          >
            <Upload size={16} />
            불러오기
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Plus size={18} />
            새 자소서
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : coverLetters.length === 0 ? (
        <div className="text-center py-20">
          <PenTool size={40} className="text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-2">아직 자기소개서가 없습니다</h3>
          <p className="text-gray-400 text-sm mb-6">경험을 먼저 정리한 후 자소서를 작성해보세요</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus size={18} /> 첫 자소서 작성하기
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {coverLetters.map(cl => (
            <div key={cl.id} className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      cl.status === 'final' ? 'bg-green-50 text-green-700' :
                      cl.status === 'review' ? 'bg-blue-50 text-blue-700' :
                      'bg-yellow-50 text-yellow-700'
                    }`}>
                      {cl.status === 'final' ? '완료' : cl.status === 'review' ? '검토 중' : '작성 중'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {cl.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || ''}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold">{cl.title}</h3>
                  {cl.targetCompany && (
                    <p className="text-sm text-gray-500">{cl.targetCompany} · {cl.targetPosition}</p>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-400 mb-4">
                {cl.questions?.length || 0}개 문항 · {cl.experienceIds?.length || 0}개 경험 연결
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-surface-100">
                <button
                  onClick={() => setDetailData(cl)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"
                >
                  <Eye size={14} /> 자세히보기
                </button>
                <Link to={`/app/coverletter/edit/${cl.id}`} className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                  <Edit size={14} /> 편집
                </Link>
                <button
                  onClick={() => setExportData(cl)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"
                >
                  <Download size={14} /> 내보내기
                </button>
                <button
                  onClick={() => { if (confirm('삭제하시겠습니까?')) deleteCoverLetter(cl.id); }}
                  className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={14} /> 삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showImport && (
        <ImportModal
          targetType="coverletter"
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}

      {detailData && (
        <DetailModal type="coverletter" data={detailData} onClose={() => setDetailData(null)} />
      )}

      {exportData && (
        <ExportModal type="coverletter" data={exportData} onClose={() => setExportData(null)} />
      )}

      {/* 기업 공고 연결 모달 */}
      {showJobLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setShowJobLink(false); setJobAnalysis(null); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-1">새 자기소개서</h2>
            <p className="text-sm text-gray-500 mb-5">
              채용공고 링크를 넣으면 기업 맞춤형 자소서가 생성됩니다 (선택)
            </p>

            {jobAnalysis ? (
              <div className="space-y-4">
                <JobAnalysisBadge analysis={jobAnalysis} onRemove={() => setJobAnalysis(null)} />
                <button
                  onClick={() => doCreate(jobAnalysis)}
                  disabled={creating}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? (
                    <><Loader2 size={14} className="animate-spin" /> 생성 중...</>
                  ) : (
                    <><Building2 size={14} /> {jobAnalysis.company} 맞춤 자소서 만들기</>
                  )}
                </button>
              </div>
            ) : (
              <JobLinkInput
                onAnalysisComplete={(analysis) => setJobAnalysis(analysis)}
                onSkip={() => doCreate(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
