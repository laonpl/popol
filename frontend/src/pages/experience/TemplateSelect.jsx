import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, PenTool, CheckSquare, Globe, Github, FileText, Upload } from 'lucide-react';
import { FRAMEWORKS } from '../../stores/experienceStore';
import ImportModal from '../../components/ImportModal';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import { useNavigate } from 'react-router-dom';

export default function TemplateSelect() {
  const frameworkList = Object.entries(FRAMEWORKS);
  const recommended = 'STAR';
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const { user } = useAuthStore();
  const { createExperience } = useExperienceStore();
  const navigate = useNavigate();

  const handleImport = async ({ imported, structured }) => {
    try {
      const data = structured || {};
      // 원본 내용이 길면 앞부분만 요약 안내와 함께 넣기
      let situationContent = '';
      if (data.content?.situation) {
        situationContent = data.content.situation;
      } else if (imported?.content) {
        const raw = imported.content;
        situationContent = raw.length > 500
          ? raw.substring(0, 500) + '\n\n... (원본 내용이 길어 일부만 표시됩니다. 위 내용을 바탕으로 직접 정리해주세요.)'
          : raw;
      }

      const newId = await createExperience(user.uid, {
        title: data.title || imported?.title || '임포트된 경험',
        framework: data.framework || 'STAR',
        content: data.content || { situation: situationContent },
      });
      navigate(`/app/experience/edit/${newId}`);
    } catch (error) {
      console.error('임포트 적용 실패:', error);
    }
  };

  return (
    <div className="animate-fadeIn">
      <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={16} /> 경험 정리로 돌아가기
      </Link>

      {!showTemplates ? (
        <>
          {/* Entry Points */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="bg-white rounded-2xl border border-surface-200 p-8 hover:shadow-lg transition-all cursor-pointer">
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-5">
                <MessageSquare size={22} className="text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">상담봇과 대화하기</h3>
              <p className="text-sm text-gray-400 mb-4">
                친근한 상담봇과 대화하며<br />숨겨진 역량을 발견하세요.
              </p>
              <span className="text-sm text-gray-600 font-medium">대화 시작 →</span>
            </div>

            <button
              onClick={() => setShowTemplates(true)}
              className="bg-white rounded-2xl border border-surface-200 p-8 hover:shadow-lg transition-all text-left"
            >
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-5">
                <PenTool size={22} className="text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">템플릿 작성</h3>
              <p className="text-sm text-gray-400 mb-4">
                이미 정리된 생각이 있다면,<br />빈칸을 채워 빠르게 완성합니다.
              </p>
              <span className="text-sm text-gray-600 font-medium">
                작성하기 →
              </span>
            </button>
          </div>

          {/* 외부 데이터 불러오기 섹션 */}
          <div className="bg-white rounded-2xl border border-surface-200 p-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-semibold">외부 연동</span>
            </div>
            <h2 className="text-xl font-bold mb-2">외부 데이터로 경험 정리하기</h2>
            <p className="text-sm text-gray-400 mb-6">노션, GitHub, PDF 등 기존 자료를 불러와서 AI가 자동으로 경험을 구조화합니다</p>

            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setShowImport(true)}
                className="p-6 rounded-xl border-2 border-surface-200 bg-white hover:border-gray-300 hover:shadow-md transition-all text-left"
              >
                <div className="w-10 h-10 bg-gray-900 text-white rounded-lg flex items-center justify-center mb-3">
                  <Globe size={20} />
                </div>
                <h4 className="font-bold mb-1">Notion</h4>
                <p className="text-xs text-gray-400">노션 페이지 URL을 붙여넣어 경험을 가져옵니다</p>
              </button>

              <button
                onClick={() => setShowImport(true)}
                className="p-6 rounded-xl border-2 border-surface-200 bg-white hover:border-gray-300 hover:shadow-md transition-all text-left"
              >
                <div className="w-10 h-10 bg-gray-800 text-white rounded-lg flex items-center justify-center mb-3">
                  <Github size={20} />
                </div>
                <h4 className="font-bold mb-1">GitHub</h4>
                <p className="text-xs text-gray-400">리포지토리 README를 자동으로 분석합니다</p>
              </button>

              <button
                onClick={() => setShowImport(true)}
                className="p-6 rounded-xl border-2 border-surface-200 bg-white hover:border-gray-300 hover:shadow-md transition-all text-left"
              >
                <div className="w-10 h-10 bg-red-500 text-white rounded-lg flex items-center justify-center mb-3">
                  <FileText size={20} />
                </div>
                <h4 className="font-bold mb-1">PDF 파일</h4>
                <p className="text-xs text-gray-400">PDF 문서에서 텍스트를 추출하여 정리합니다</p>
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* 템플릿 선택 화면 */}
          <div className="bg-white rounded-2xl border border-surface-200 p-8">
            <button
              onClick={() => setShowTemplates(false)}
              className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block"
            >
              ← 뒤로가기
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-semibold">AI 추천 완료</span>
            </div>
            <h2 className="text-xl font-bold mb-2">당신에게 추천하는 최고 템플릿</h2>
            <p className="text-sm text-gray-400 mb-6">설문 결과를 바탕으로 가장 적합한 템플릿을 선별합니다</p>

            {/* Recommended - highlighted */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {frameworkList.slice(0, 3).map(([key, fw], i) => (
                <Link
                  key={key}
                  to={`/app/experience/edit/new/${key}`}
                  className={`p-5 rounded-xl border-2 transition-all hover:shadow-md ${
                    i === 0 ? 'border-primary-400 bg-primary-50' : 'border-surface-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {i === 0 && (
                    <span className="inline-block px-2 py-0.5 bg-primary-500 text-white rounded text-[10px] font-bold mb-2">추천</span>
                  )}
                  <h4 className="font-bold mb-1">{fw.name}</h4>
                  <p className="text-xs text-gray-400 mb-3">{fw.description}</p>
                  <div className="text-xs text-gray-500">
                    <p className="font-medium mb-1">질문 미리보기</p>
                    {fw.fields.slice(0, 2).map(f => (
                      <p key={f.key} className="text-gray-400">· {f.label}</p>
                    ))}
                    <p className="text-gray-300">· {fw.fields.length > 2 ? `+${fw.fields.length - 2}개 더` : ''}</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Other templates */}
            <div>
              <h3 className="text-sm font-bold mb-3 text-gray-600">다른 템플릿도 둘러보기</h3>
              <div className="grid grid-cols-4 gap-3">
                {frameworkList.map(([key, fw]) => (
                  <Link
                    key={key}
                    to={`/app/experience/edit/new/${key}`}
                    className="p-4 bg-surface-50 rounded-xl hover:bg-surface-100 transition-colors"
                  >
                    <h4 className="text-sm font-bold">{fw.name}</h4>
                    <p className="text-xs text-gray-400 mt-1">{fw.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {showImport && (
        <ImportModal
          targetType="experience"
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}
    </div>
  );
}
