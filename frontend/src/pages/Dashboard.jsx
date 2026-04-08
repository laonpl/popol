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
        <h1 className="text-2xl font-bold text-bluewood-900">안녕하세요, {user?.displayName || '사용자'}님 👋</h1>
        <p className="text-bluewood-400 mt-1">오늘도 취업 준비를 함께 시작해볼까요?</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={FolderOpen} label="정리된 경험" count={experiences.length} color="blue" to="/app/experience" />
        <StatCard icon={FileText} label="포트폴리오" count={portfolios.length} color="caribbean" to="/app/portfolio" />
        <StatCard icon={PenTool} label="자기소개서" count={coverLetters.length} color="bluewood" to="/app/coverletter" />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-bluewood-900 mb-4">빠른 시작</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link
            to="/app/experience/new"
            className="flex items-center gap-4 p-6 bg-white rounded-2xl border border-surface-200 hover:shadow-card-hover transition-all group hover:-translate-y-0.5"
          >
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
              <Plus size={22} className="text-primary-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-bluewood-900">새 경험 정리하기</h3>
              <p className="text-sm text-bluewood-400">STAR, 5F, PMI 등 프레임워크 선택</p>
            </div>
            <ArrowRight size={18} className="text-surface-300 group-hover:text-primary-500 transition-colors" />
          </Link>
          <Link
            to="/app/coverletter"
            className="flex items-center gap-4 p-6 bg-white rounded-2xl border border-surface-200 hover:shadow-card-hover transition-all group hover:-translate-y-0.5"
          >
            <div className="w-12 h-12 bg-bluewood-50 rounded-xl flex items-center justify-center">
              <PenTool size={22} className="text-bluewood-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-bluewood-900">자기소개서 작성</h3>
              <p className="text-sm text-bluewood-400">경험 DB 기반 AI 초안 생성</p>
            </div>
            <ArrowRight size={18} className="text-surface-300 group-hover:text-primary-500 transition-colors" />
          </Link>
        </div>
      </div>

      {/* Recent Experiences */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-bluewood-900">최근 정리한 경험</h2>
          <Link to="/app/experience" className="text-sm text-primary-500 hover:text-primary-600 font-medium">전체 보기</Link>
        </div>
        {experiences.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-surface-200 shadow-card">
            <FolderOpen size={40} className="text-surface-300 mx-auto mb-3" />
            <p className="text-bluewood-400">아직 정리된 경험이 없습니다</p>
            <Link to="/app/experience/new" className="inline-block mt-3 text-sm text-primary-500 hover:text-primary-600 font-medium">
              첫 경험 정리하기 →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {experiences.slice(0, 3).map(exp => (
              <Link
                key={exp.id}
                to={`/app/experience/edit/${exp.id}`}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-surface-200 hover:shadow-card-hover transition-all hover:-translate-y-0.5"
              >
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-sm font-bold text-primary-500">
                  {exp.framework?.charAt(0) || 'S'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-bluewood-900 truncate">{exp.title}</p>
                  <p className="text-xs text-bluewood-400">{exp.framework} · {exp.createdAt?.toDate?.()?.toLocaleDateString?.('ko-KR') || '날짜 없음'}</p>
                </div>
                {exp.keywords?.length > 0 && (
                  <div className="flex gap-1">
                    {exp.keywords.slice(0, 2).map(k => (
                      <span key={k} className="px-2 py-1 bg-primary-50 text-primary-600 rounded-md text-xs font-medium">#{k}</span>
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
    blue: 'bg-primary-50 text-primary-500',
    caribbean: 'bg-caribbean-50 text-caribbean-600',
    bluewood: 'bg-bluewood-50 text-bluewood-600',
  };

  return (
    <Link to={to} className="p-5 bg-white rounded-2xl border border-surface-200 hover:shadow-card-hover transition-all hover:-translate-y-0.5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-bluewood-900">{count}</p>
      <p className="text-sm text-bluewood-400">{label}</p>
    </Link>
  );
}
