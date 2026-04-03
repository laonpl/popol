import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, FileText, PenTool, Plus, ArrowRight } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useExperienceStore from '../stores/experienceStore';
import usePortfolioStore from '../stores/portfolioStore';
import useCoverLetterStore from '../stores/coverLetterStore';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { experiences, fetchExperiences } = useExperienceStore();
  const { portfolios, fetchPortfolios } = usePortfolioStore();
  const { coverLetters, fetchCoverLetters } = useCoverLetterStore();

  useEffect(() => {
    if (user?.uid) {
      fetchExperiences(user.uid);
      fetchPortfolios(user.uid);
      fetchCoverLetters(user.uid);
    }
  }, [user?.uid]);

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">안녕하세요, {user?.displayName || '사용자'}님 👋</h1>
        <p className="text-gray-500 mt-1">오늘도 취업 준비를 함께 시작해볼까요?</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={FolderOpen} label="정리된 경험" count={experiences.length} color="blue" to="/app/experience" />
        <StatCard icon={FileText} label="포트폴리오" count={portfolios.length} color="green" to="/app/portfolio" />
        <StatCard icon={PenTool} label="자기소개서" count={coverLetters.length} color="purple" to="/app/coverletter" />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-4">빠른 시작</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link
            to="/app/experience/new"
            className="flex items-center gap-4 p-6 bg-white rounded-2xl border border-surface-200 hover:shadow-lg transition-all group"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <Plus size={22} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold">새 경험 정리하기</h3>
              <p className="text-sm text-gray-400">STAR, 5F, PMI 등 프레임워크 선택</p>
            </div>
            <ArrowRight size={18} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
          </Link>
          <Link
            to="/app/coverletter"
            className="flex items-center gap-4 p-6 bg-white rounded-2xl border border-surface-200 hover:shadow-lg transition-all group"
          >
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <PenTool size={22} className="text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold">자기소개서 작성</h3>
              <p className="text-sm text-gray-400">경험 DB 기반 AI 초안 생성</p>
            </div>
            <ArrowRight size={18} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
          </Link>
        </div>
      </div>

      {/* Recent Experiences */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">최근 정리한 경험</h2>
          <Link to="/app/experience" className="text-sm text-primary-600 hover:underline">전체 보기</Link>
        </div>
        {experiences.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-surface-200">
            <FolderOpen size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">아직 정리된 경험이 없습니다</p>
            <Link to="/app/experience/new" className="inline-block mt-3 text-sm text-primary-600 hover:underline">
              첫 경험 정리하기 →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {experiences.slice(0, 3).map(exp => (
              <Link
                key={exp.id}
                to={`/app/experience/edit/${exp.id}`}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-surface-200 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-sm font-bold text-primary-600">
                  {exp.framework?.charAt(0) || 'S'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{exp.title}</p>
                  <p className="text-xs text-gray-400">{exp.framework} · {exp.createdAt?.toDate?.()?.toLocaleDateString?.('ko-KR') || '날짜 없음'}</p>
                </div>
                {exp.keywords?.length > 0 && (
                  <div className="flex gap-1">
                    {exp.keywords.slice(0, 2).map(k => (
                      <span key={k} className="px-2 py-1 bg-primary-50 text-primary-600 rounded-md text-xs">#{k}</span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, count, color, to }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Link to={to} className="p-5 bg-white rounded-2xl border border-surface-200 hover:shadow-md transition-all">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </Link>
  );
}
