import { useNavigate } from 'react-router-dom';
import { ArrowRight, FolderOpen, FileText, PenTool, CheckCircle2, Sparkles, Briefcase } from 'lucide-react';
import useAuthStore from '../stores/authStore';

export default function Landing() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const handleStart = () => {
    if (user) {
      navigate('/app');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] via-white to-primary-50">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
            <Briefcase size={16} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-bluewood-900">POPOL</h1>
        </div>
        <button
          onClick={handleStart}
          className="px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors shadow-sm"
        >
          {user ? '대시보드로' : '시작하기'}
        </button>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center pt-20 pb-16 px-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-full text-sm font-medium mb-6 border border-primary-100">
          <Sparkles size={16} />
          AI 기반 올인원 취업 준비 플랫폼
        </div>
        <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6 text-bluewood-900">
          경험을 정리하고,<br />
          <span className="text-primary-500">완벽한 포트폴리오</span>를 만드세요
        </h2>
        <p className="text-lg text-bluewood-400 max-w-2xl mx-auto mb-10">
          파편화된 경험을 STAR·5F·PMI 프레임워크로 체계적으로 정리하고,
          기업 맞춤형 포트폴리오와 자기소개서를 AI와 함께 완성하세요.
        </p>
        <button
          onClick={handleStart}
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary-500 text-white rounded-2xl text-lg font-semibold hover:bg-primary-600 shadow-lg shadow-primary-200 transition-all hover:shadow-xl hover:-translate-y-0.5"
        >
          무료로 시작하기
          <ArrowRight size={20} />
        </button>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={FolderOpen}
            title="경험 정리"
            desc="STAR, 5F, PMI 등 검증된 프레임워크로 경험을 체계적으로 아카이빙하고 AI가 역량 키워드를 자동 분석합니다."
            color="bg-primary-50 text-primary-500"
          />
          <FeatureCard
            icon={FileText}
            title="포트폴리오 작성"
            desc="정리된 경험을 기반으로 포트폴리오를 자동 구성하고 6단계 체크리스트로 완벽한 결과물을 보장합니다."
            color="bg-caribbean-50 text-caribbean-600"
          />
          <FeatureCard
            icon={PenTool}
            title="자기소개서"
            desc="경험 DB와 연동하여 문항별 맞춤 초안을 AI가 생성하고, 글자 수 관리부터 첨삭까지 지원합니다."
            color="bg-bluewood-50 text-bluewood-600"
          />
        </div>

        {/* Killer Feature Highlight */}
        <div className="mt-12 bg-white rounded-2xl border border-surface-200 p-8 shadow-card">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-50 rounded-xl">
              <CheckCircle2 size={24} className="text-primary-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-bluewood-900 mb-2">Export 전 6단계 필수 체크리스트</h3>
              <p className="text-bluewood-400 text-sm mb-4">
                용량 · 포맷 · 네이밍 · 기업 맞춤 · 기여도 명시 · 오타/비문 검수 
                — 모든 항목을 통과해야만 파일이 생성됩니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {['📦 20MB 이하 자동 압축', '📄 포맷 자동 매칭', '✏️ 네이밍 규격 검사', '🎯 AI 맞춤형 검토', '👥 기여도 스캔', '🔍 오타/비문 정렬 점검'].map(tag => (
                  <span key={tag} className="px-3 py-1.5 bg-surface-100 rounded-lg text-xs text-bluewood-600 font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, color }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-card-hover transition-all hover:-translate-y-0.5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}>
        <Icon size={22} />
      </div>
      <h3 className="text-lg font-bold text-bluewood-900 mb-2">{title}</h3>
      <p className="text-sm text-bluewood-400 leading-relaxed">{desc}</p>
    </div>
  );
}
