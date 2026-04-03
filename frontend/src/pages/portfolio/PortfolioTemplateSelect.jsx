import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Code, Palette, Briefcase, GraduationCap, Rocket, Check, Loader2, BookOpen, Building2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import JobLinkInput, { JobAnalysisBadge } from '../../components/JobLinkInput';
import toast from 'react-hot-toast';

const PORTFOLIO_TEMPLATES = [
  {
    id: 'notion',
    name: 'Notion 이력서/포트폴리오',
    icon: BookOpen,
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    iconColor: 'bg-amber-500 text-white',
    description: '노션 스타일의 이력서 + 포트폴리오 통합 템플릿. 프로필, 학력, 경험, 수상, 기술, 교과/비교과 활동을 한 눈에 정리하고 Notion으로 내보내기까지!',
    tags: ['이력서', '포트폴리오', 'Notion 내보내기', 'All-in-One'],
    sections: [],
    isNotion: true,
  },
  {
    id: 'developer',
    name: '개발자 포트폴리오',
    icon: Code,
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    iconColor: 'bg-blue-500 text-white',
    description: '기술 스택, 프로젝트 경험, 기술 블로그를 중심으로 구성된 개발자 맞춤 템플릿',
    tags: ['기술 스택', 'GitHub', '프로젝트', 'API'],
    sections: [
      { type: 'intro', title: '자기소개', content: '' },
      { type: 'skills', title: '기술 스택', content: '' },
      { type: 'experience', title: '주요 프로젝트 1', content: '', role: '', contribution: '' },
      { type: 'experience', title: '주요 프로젝트 2', content: '', role: '', contribution: '' },
      { type: 'custom', title: '기술 블로그 / 오픈소스 기여', content: '' },
      { type: 'education', title: '학력 및 교육', content: '' },
    ],
  },
  {
    id: 'designer',
    name: '디자이너 포트폴리오',
    icon: Palette,
    color: 'bg-pink-50 border-pink-200 text-pink-700',
    iconColor: 'bg-pink-500 text-white',
    description: '디자인 프로세스, 비주얼 작업물, UX 리서치를 강조하는 디자인 전문 템플릿',
    tags: ['UI/UX', '디자인 프로세스', '작업물', '리서치'],
    sections: [
      { type: 'intro', title: '디자이너 소개', content: '' },
      { type: 'custom', title: '디자인 철학 & 프로세스', content: '' },
      { type: 'experience', title: '프로젝트 1 - UI/UX 디자인', content: '', role: '', contribution: '' },
      { type: 'experience', title: '프로젝트 2 - 브랜드 디자인', content: '', role: '', contribution: '' },
      { type: 'skills', title: '사용 도구 & 스킬', content: '' },
      { type: 'awards', title: '수상 & 전시', content: '' },
    ],
  },
  {
    id: 'business',
    name: '비즈니스/기획 포트폴리오',
    icon: Briefcase,
    color: 'bg-green-50 border-green-200 text-green-700',
    iconColor: 'bg-green-500 text-white',
    description: '사업 기획, 마케팅 전략, 데이터 분석 경험을 정리하는 비즈니스 템플릿',
    tags: ['기획', '전략', '데이터 분석', '마케팅'],
    sections: [
      { type: 'intro', title: '자기소개', content: '' },
      { type: 'custom', title: '핵심 역량 & 강점', content: '' },
      { type: 'experience', title: '프로젝트/인턴 경험 1', content: '', role: '', contribution: '' },
      { type: 'experience', title: '프로젝트/인턴 경험 2', content: '', role: '', contribution: '' },
      { type: 'custom', title: '데이터 분석 / 성과', content: '' },
      { type: 'education', title: '학력 & 자격증', content: '' },
    ],
  },
  {
    id: 'academic',
    name: '학술/연구 포트폴리오',
    icon: GraduationCap,
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    iconColor: 'bg-purple-500 text-white',
    description: '연구 경험, 논문, 학술 활동을 체계적으로 정리하는 학술 연구 템플릿',
    tags: ['연구', '논문', '학회', '실험'],
    sections: [
      { type: 'intro', title: '연구자 소개', content: '' },
      { type: 'custom', title: '연구 관심 분야', content: '' },
      { type: 'experience', title: '연구 프로젝트 1', content: '', role: '', contribution: '' },
      { type: 'experience', title: '연구 프로젝트 2', content: '', role: '', contribution: '' },
      { type: 'custom', title: '논문 & 발표', content: '' },
      { type: 'awards', title: '수상 & 장학금', content: '' },
      { type: 'education', title: '학력', content: '' },
    ],
  },
  {
    id: 'startup',
    name: '스타트업/창업 포트폴리오',
    icon: Rocket,
    color: 'bg-orange-50 border-orange-200 text-orange-700',
    iconColor: 'bg-orange-500 text-white',
    description: '창업 경험, MVP, 시장 분석, 성장 지표를 보여주는 스타트업 템플릿',
    tags: ['창업', 'MVP', '성장', '투자'],
    sections: [
      { type: 'intro', title: '창업자 소개', content: '' },
      { type: 'custom', title: '문제 정의 & 솔루션', content: '' },
      { type: 'experience', title: '프로젝트/서비스 1', content: '', role: '', contribution: '' },
      { type: 'custom', title: '성장 지표 & 성과', content: '' },
      { type: 'custom', title: '팀 구성 & 역할', content: '' },
      { type: 'awards', title: '수상 & 대외 활동', content: '' },
    ],
  },
  {
    id: 'blank',
    name: '빈 템플릿',
    icon: FileText,
    color: 'bg-gray-50 border-gray-200 text-gray-700',
    iconColor: 'bg-gray-500 text-white',
    description: '자유롭게 섹션을 추가하며 나만의 포트폴리오를 구성하세요',
    tags: ['자유 형식', '커스텀'],
    sections: [],
  },
];

export default function PortfolioTemplateSelect() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createPortfolio } = usePortfolioStore();
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState('template'); // template | joblink
  const [jobAnalysis, setJobAnalysis] = useState(null);

  const handleNext = () => {
    if (!selected) { toast.error('템플릿을 선택해주세요'); return; }
    setStep('joblink');
  };

  const handleCreate = async (analysis) => {
    const finalAnalysis = analysis || jobAnalysis;
    const template = PORTFOLIO_TEMPLATES.find(t => t.id === selected);
    if (!template) return;

    setCreating(true);
    try {
      const data = {
        title: template.id === 'blank' ? '새 포트폴리오' : `${template.name}`,
        userName: user.displayName || '',
        sections: template.sections.map((s, i) => ({ ...s, order: i })),
        templateId: template.id,
      };
      if (finalAnalysis) {
        data.targetCompany = finalAnalysis.company || '';
        data.targetPosition = finalAnalysis.position || '';
        data.jobAnalysis = finalAnalysis;
      }
      if (template.isNotion) {
        data.templateType = 'notion';
        data.headline = '';
        data.education = [];
        data.awards = [];
        data.experiences = [];
        data.contact = { phone: '', email: '', linkedin: '', instagram: '', github: '', website: '' };
        data.skills = { tools: [], languages: [], frameworks: [], others: [] };
        data.goals = [];
        data.values = [];
        data.interests = [];
        data.curricular = { summary: { credits: '', gpa: '' }, courses: [], creditStatus: [] };
        data.extracurricular = { summary: '', badges: [], languages: [], details: [] };
        data.valuesEssay = '';
      }
      const id = await createPortfolio(user.uid, data);
      if (template.isNotion) {
        navigate(`/app/portfolio/edit-notion/${id}`);
      } else {
        navigate(`/app/portfolio/edit/${id}`);
      }
      toast.success('포트폴리오가 생성되었습니다!');
    } catch (error) {
      toast.error('포트폴리오 생성에 실패했습니다');
    }
    setCreating(false);
  };

  return (
    <div className="animate-fadeIn">
      <Link to="/app/portfolio" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={16} /> 포트폴리오 목록으로
      </Link>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-3 mb-8">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${step === 'template' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
          <span className="w-5 h-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center">1</span>
          템플릿 선택
        </div>
        <ArrowRight size={14} className="text-gray-300" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${step === 'joblink' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'}`}>
          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${step === 'joblink' ? 'bg-primary-500 text-white' : 'bg-gray-300 text-white'}`}>2</span>
          기업 공고 연결 (선택)
        </div>
      </div>

      {step === 'template' && (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">포트폴리오 템플릿 선택</h1>
            <p className="text-gray-500 text-sm">
              직무에 맞는 템플릿을 선택하면, 최적화된 섹션 구조가 자동으로 구성됩니다
            </p>
          </div>

      {/* Template Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {PORTFOLIO_TEMPLATES.map(template => {
          const Icon = template.icon;
          const isSelected = selected === template.id;
          return (
            <button
              key={template.id}
              onClick={() => setSelected(template.id)}
              className={`p-6 rounded-2xl border-2 text-left transition-all hover:shadow-lg ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-200'
                  : 'border-surface-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${template.iconColor}`}>
                  <Icon size={22} />
                </div>
                {isSelected && (
                  <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                )}
              </div>
              <h3 className="font-bold mb-1">{template.name}</h3>
              <p className="text-xs text-gray-400 mb-3 leading-relaxed">{template.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {template.tags.map(tag => (
                  <span key={tag} className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${template.color}`}>
                    {tag}
                  </span>
                ))}
              </div>
              {template.sections.length > 0 && (
                <p className="text-[10px] text-gray-400 mt-3">
                  {template.sections.length}개 섹션 포함
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Template Preview */}
      {selected && selected !== 'blank' && (
        <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
          <h3 className="font-bold mb-3">
            {PORTFOLIO_TEMPLATES.find(t => t.id === selected)?.name} 구성 미리보기
          </h3>
          <div className="flex flex-wrap gap-2">
            {PORTFOLIO_TEMPLATES.find(t => t.id === selected)?.sections.map((section, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-surface-50 rounded-lg">
                <span className="text-xs font-bold text-primary-600">{i + 1}</span>
                <span className="text-sm text-gray-700">{section.title}</span>
                <span className="text-[10px] text-gray-400 px-1.5 py-0.5 bg-surface-100 rounded">
                  {section.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Button */}
      <div className="sticky bottom-6">
        <button
          onClick={handleNext}
          disabled={!selected}
          className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowRight size={18} /> {selected ? '다음: 기업 공고 연결' : '템플릿을 선택해주세요'}
        </button>
      </div>
        </>
      )}

      {step === 'joblink' && (
        <>
          <div className="mb-6">
            <button onClick={() => setStep('template')} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
              <ArrowLeft size={14} /> 템플릿 다시 선택
            </button>
            <h1 className="text-2xl font-bold mb-2">기업 공고 연결</h1>
            <p className="text-gray-500 text-sm">
              지원할 기업의 채용공고 링크를 넣으면 기업 맞춤형 포트폴리오가 생성됩니다 (선택사항)
            </p>
          </div>

          {jobAnalysis ? (
            <div className="space-y-4">
              <JobAnalysisBadge analysis={jobAnalysis} onRemove={() => setJobAnalysis(null)} />
              <button
                onClick={() => handleCreate(jobAnalysis)}
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {creating ? (
                  <><Loader2 size={18} className="animate-spin" /> 생성 중...</>
                ) : (
                  <><Building2 size={18} /> {jobAnalysis.company} 맞춤 포트폴리오 만들기</>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <JobLinkInput
                onAnalysisComplete={(analysis) => setJobAnalysis(analysis)}
                onSkip={() => handleCreate(null)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export { PORTFOLIO_TEMPLATES };
