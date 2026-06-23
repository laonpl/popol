import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Edit, Loader2, MapPin, Calendar,
  ExternalLink, Mail, Phone, Globe, ChevronUp, X, FileText,
  ChevronRight, Tag, Share2, Copy, Check, Link2
} from 'lucide-react';
import { doc, getDoc } from '../../services/firestoreProxy';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import toast from 'react-hot-toast';
import VisualPortfolioRenderer, { VISUAL_TEMPLATE_IDS, VHtml } from './VisualPortfolioTemplates';
const ProjectDetailModal = lazy(() => import('../../components/ProjectDetailModal'));
import { useOnboarding } from '../../components/OnboardingOverlay';
import GuidedTutorial from '../../components/GuidedTutorial';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import ResumeExportModal from '../../components/ResumeExportModal';
import { uploadImageUrl } from '../../services/uploadImage';

const DEFAULT_PROJECT_LOGO = '/logo.png';

function withDefaultProjectLogos(portfolio) {
  if (!portfolio) return portfolio;
  return {
    ...portfolio,
    experiences: (portfolio.experiences || []).map(exp => ({
      ...exp,
      thumbnailUrl: exp.thumbnailUrl || DEFAULT_PROJECT_LOGO,
    })),
  };
}

const PREVIEW_REORDERABLE_SECTION_MAP = {
  ashley: ['profile', 'education', 'awards', 'experiences', 'interviews', 'books', 'lectures', 'skills', 'goals', 'values', 'funfacts', 'contact'],
  academic: ['profile', 'education', 'awards', 'experiences', 'curricular', 'extracurricular', 'skills', 'goals', 'values', 'contact'],
  notion: ['profile', 'education', 'awards', 'experiences', 'curricular', 'extracurricular', 'skills', 'goals', 'values', 'contact'],
  timeline: ['profile', 'education', 'curricular', 'activities', 'goals', 'skills', 'awards', 'contact'],
};

function makePreviewSectionOrder(templateId, sectionOrder) {
  const reorderable = PREVIEW_REORDERABLE_SECTION_MAP[templateId] || PREVIEW_REORDERABLE_SECTION_MAP.notion;
  const saved = Array.isArray(sectionOrder)
    ? sectionOrder.filter(key => reorderable.includes(key))
    : [];
  const order = saved.length > 0
    ? [...saved, ...reorderable.filter(key => !saved.includes(key))]
    : reorderable;

  return (key) => {
    const index = order.indexOf(key);
    return index >= 0 ? index : order.length;
  };
}

const TUTORIAL_PORTFOLIO_EXPERIENCE = {
  id: 'tutorial-portfolio-experience',
  title: '예시 경험: 서비스 개선 프로젝트',
  status: 'finished',
  classify: ['프로젝트', '기획'],
  skills: ['문제정의', '프로토타입', '데이터 분석'],
  keywords: ['사용자 경험', '성과 개선', '협업'],
  role: 'PM / 프론트엔드',
  date: '2026.03 - 2026.06',
  structuredResult: {
    projectOverview: {
      role: 'PM / 프론트엔드',
      duration: '2026.03 - 2026.06',
      summary: '공지 확인 흐름을 개선하기 위해 사용자 인터뷰와 프로토타입 검증을 진행했습니다.',
      goal: '사용자가 놓치는 정보를 줄이고 반복 확인 시간을 낮추는 것',
      techStack: ['Figma', 'React', 'Firebase'],
    },
    intro: '학생들이 공지를 확인하는 과정에서 반복적으로 놓치는 지점을 발견하고 개선 프로젝트를 시작했습니다.',
    task: '인터뷰 질문 설계, 문제 패턴 정리, 핵심 화면 프로토타입 제작을 맡았습니다.',
    process: '12명의 사용자를 인터뷰하고 주요 불편을 3가지 흐름으로 묶어 우선순위를 정했습니다.',
    output: '테스트 만족도 4.6/5를 기록했고 공지 확인 누락률을 32% 낮추는 개선안을 도출했습니다.',
    growth: '정성 인터뷰를 실제 화면 구조와 성과 지표로 연결하는 경험을 얻었습니다.',
  },
};

export default function NotionPortfolioPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { updatePortfolio, setCurrentPortfolio } = usePortfolioStore();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [selectedExpDetail, setSelectedExpDetail] = useState(null);
  const [isPublic, setIsPublic] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const activeSlug = customSlug || id;
  const previewTutorialKey = user?.uid ? `portfolio-preview-tutorial-${user.uid}` : null;
  const forcePreviewTutorial = new URLSearchParams(location.search).get('tutorial') === '1';
  const { visible: previewTutorialVisible, dismiss: dismissPreviewTutorial } = useOnboarding(previewTutorialKey, { force: forcePreviewTutorial });
  const previewTutorialRef = useRef(null);
  const [previewTutorialCurrentStep, setPreviewTutorialCurrentStep] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const inactiveSaveTimer = useRef(null);
  const pendingSaveRef = useRef(false);
  const queuedPortfolioRef = useRef(null);
  const lastScheduledSnapshotRef = useRef(null);

  useUnsavedChanges(hasUnsavedChanges);

  useEffect(() => { loadData(); }, [id, user?.uid]);

  const persistPortfolio = useCallback(async (snapshot) => {
    if (!snapshot) return;
    if (pendingSaveRef.current) {
      queuedPortfolioRef.current = snapshot;
      return;
    }
    pendingSaveRef.current = true;
    try {
      const { id: _id, ...data } = snapshot;
      await updatePortfolio(id, data);
    } catch {
      toast.error('프로젝트 수정사항 저장에 실패했습니다');
    } finally {
      pendingSaveRef.current = false;
      const queued = queuedPortfolioRef.current;
      queuedPortfolioRef.current = null;
      if (queued && queued !== snapshot) persistPortfolio(queued);
    }
  }, [id, updatePortfolio]);

  const schedulePortfolioSave = useCallback((snapshot) => {
    if (inactiveSaveTimer.current) clearTimeout(inactiveSaveTimer.current);
    lastScheduledSnapshotRef.current = snapshot;
    inactiveSaveTimer.current = window.setTimeout(() => {
      const scheduledSnapshot = lastScheduledSnapshotRef.current;
      lastScheduledSnapshotRef.current = null;
      persistPortfolio(scheduledSnapshot);
    }, 700);
  }, [persistPortfolio]);

  useEffect(() => () => {
    if (inactiveSaveTimer.current) clearTimeout(inactiveSaveTimer.current);
    if (lastScheduledSnapshotRef.current) {
      persistPortfolio(lastScheduledSnapshotRef.current);
      lastScheduledSnapshotRef.current = null;
    }
  }, [persistPortfolio]);

  const loadData = async () => {
    try {
      const snap = await getDoc(doc(db, 'portfolios', id));
      if (snap.exists()) {
        const p = { id: snap.id, ...snap.data() };
        const nextPortfolio = withDefaultProjectLogos(p);
        setPortfolio(nextPortfolio);
        setCurrentPortfolio(nextPortfolio);
        setIsPublic(!!p.isPublic);
        setCustomSlug(p.customSlug || '');
      }
    } catch (e) { toast.error('불러오기 실패'); }
    setLoading(false);
  };

  const closePreviewTutorial = (permanent = false) => {
    setShowExportModal(false);
    setSelectedExpDetail(null);
    dismissPreviewTutorial(permanent);
  };

  const resolveExperienceIndex = useCallback((exp, idx) => {
    const list = portfolio?.experiences || [];
    if (Number.isInteger(idx) && idx >= 0 && idx < list.length) return idx;
    return list.findIndex(item => {
      if (item === exp) return true;
      if (exp?.experienceId && item?.experienceId === exp.experienceId) return true;
      if (exp?.id && item?.id === exp.id) return true;
      return item?.title === exp?.title && (item?.date || item?.period || '') === (exp?.date || exp?.period || '');
    });
  }, [portfolio?.experiences]);

  const openExperienceDetail = useCallback((exp, idx) => {
    if (!exp) {
      setSelectedExpDetail(null);
      return;
    }
    const resolvedIdx = resolveExperienceIndex(exp, idx);
    const currentExp = resolvedIdx >= 0 ? (portfolio?.experiences || [])[resolvedIdx] : exp;
    setSelectedExpDetail({ exp: currentExp, idx: resolvedIdx });
  }, [portfolio?.experiences, resolveExperienceIndex]);

  const updateSelectedExperience = useCallback((changes) => {
    const idx = selectedExpDetail?.idx;
    if (!Number.isInteger(idx) || idx < 0) return;

    setSelectedExpDetail(prev => {
      if (!prev) return prev;
      const merged = { ...(prev.exp || {}), ...changes };
      return { ...prev, exp: merged };
    });

    setPortfolio(prev => {
      if (!prev) return prev;
      const experiences = [...(prev.experiences || [])];
      if (!experiences[idx]) return prev;
      experiences[idx] = { ...experiences[idx], ...changes };
      const next = withDefaultProjectLogos({ ...prev, experiences });
      setCurrentPortfolio(next);
      setHasUnsavedChanges(true);
      return next;
    });
  }, [selectedExpDetail?.idx, setCurrentPortfolio]);

  const previewTutorialSteps = [
    {
      selector: '[data-tour="portfolio-edit"]',
      title: '편집을 눌러서 수정 화면으로 돌아가보세요',
      body: '미리보기에서 부족한 섹션을 발견하면 이 버튼을 눌러서 블록, 문장, 섹션 순서를 바로 고칠 수 있습니다.',
    },
    {
      selector: '[data-tour="portfolio-link"]',
      title: '링크 내보내기를 눌러서 설정을 확인해보세요',
      body: '공개 여부와 복사 가능한 공유 링크를 여기서 관리합니다. 튜토리얼에서는 설정 창만 열어서 흐름을 보여드립니다.',
    },
    {
      selector: '[data-tour="portfolio-public-toggle"]',
      title: '공개 토글을 눌러서 링크 상태를 바꿔보세요',
      body: '이 토글을 켜면 공개 링크가 활성화되고, 링크를 아는 사람이 포트폴리오를 볼 수 있습니다. 튜토리얼 중에는 실제 저장 없이 다음 단계로만 넘어갑니다.',
      preview: <p>튜토리얼은 저장 값을 바꾸지 않고 위치와 의미만 먼저 보여드립니다.</p>,
      onEnter: () => setShowExportModal(true),
    },
    {
      selector: '[data-tour="portfolio-ppt"]',
      title: 'PPT 내보내기를 눌러서 발표 자료로 옮겨보세요',
      body: '포트폴리오 내용을 발표 자료로 만들 때 이 버튼을 사용합니다. 현재 미리보기의 섹션과 경험 구성이 내보내기 기준이 됩니다.',
      onEnter: () => setShowExportModal(false),
    },
    {
      selector: '[data-tour="portfolio-preview-surface"]',
      title: '경험 항목을 눌러서 상세 화면을 열어보세요',
      body: '노션 포트폴리오에서는 프로젝트 카드나 경험 항목을 누르면 상세 페이지처럼 열립니다. 데이터가 없을 때도 예시 화면으로 먼저 확인할 수 있습니다.',
      actionLabel: '상세 예시 열기',
      onEnter: () => setShowExportModal(false),
      onAction: () => openExperienceDetail((portfolio?.experiences || [])[0] || TUTORIAL_PORTFOLIO_EXPERIENCE, 0),
    },
    {
      selector: '[data-tour="portfolio-detail-modal"]',
      title: '상세 내용을 눌러서 연결된 정보를 확인해보세요',
      body: '경험 정리에서 만든 핵심 내용, 키워드, 성과가 포트폴리오 상세 화면에 이런 방식으로 펼쳐집니다.',
    },
  ];

  const handleTutorialPublicToggle = () => {
    if (!(previewTutorialVisible && previewTutorialCurrentStep === 2)) return false;
    toast.success('튜토리얼에서는 공개 설정을 저장하지 않았습니다');
    previewTutorialRef.current?.next();
    return true;
  };

  const pptLayoutIds = ['narrative', 'star', 'kpi-dashboard', 'timeline', 'case-study'];
  const pptTemplateQuery = pptLayoutIds.includes(portfolio?.templateId) ? `?template=${portfolio.templateId}` : '';
  const pptExportUrl = `/app/portfolio/ai-ppt/${id}${pptTemplateQuery}`;

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-600" /></div>;
  if (!portfolio) return <p className="text-center py-20 text-gray-400">포트폴리오를 찾을 수 없습니다</p>;

  // 비주얼 템플릿이면 별도 렌더러로 분기
  if (VISUAL_TEMPLATE_IDS.includes(portfolio?.templateId)) {
    return (
      <div className="animate-fadeIn">
        <GuidedTutorial
          ref={previewTutorialRef}
          visible={previewTutorialVisible}
          steps={previewTutorialSteps}
          onSkip={() => closePreviewTutorial(false)}
          onNeverShow={() => closePreviewTutorial(true)}
          onStepChange={setPreviewTutorialCurrentStep}
        />
        {/* Admin bar */}
        <div className="flex items-center justify-between mb-4 max-w-[1100px] mx-auto">
          <Link to="/app/portfolio" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bluewood-400 hover:text-primary-600 transition-colors">
            <ArrowLeft size={14} /> 목록으로
          </Link>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-600 ring-1 ring-amber-100">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                저장 안 됨
              </span>
            )}
            <Link to={`/app/portfolio/preview/${id}?tutorial=1`}
              className="px-4 py-2 bg-white border border-surface-200 text-bluewood-500 rounded-xl text-[13px] font-medium hover:border-primary-200 hover:text-primary-600 hover:bg-surface-50 transition-all">
              튜토리얼 보기
            </Link>
            <button data-tour="portfolio-edit" onClick={() => navigate(`/app/portfolio/edit-notion/${id}`)}
              className="px-4 py-2 bg-white border border-surface-200 text-bluewood-600 rounded-xl text-[13px] font-medium hover:border-bluewood-300 hover:bg-surface-50 transition-all">
              편집
            </button>
            <button data-tour="portfolio-ppt" onClick={() => navigate(pptExportUrl)}
              className="px-4 py-2 bg-bluewood-700 text-white rounded-xl text-[13px] font-semibold hover:bg-bluewood-800 transition-all">
              PPT 내보내기
            </button>
            <button onClick={() => setShowResumeModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[13px] font-semibold hover:bg-emerald-700 transition-all">
              이력서 내보내기
            </button>
            <button data-tour="portfolio-link" onClick={() => {
              setShowExportModal(true);
              if (previewTutorialVisible && previewTutorialCurrentStep === 1) previewTutorialRef.current?.next();
            }}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl text-[13px] font-semibold hover:bg-primary-700 transition-all shadow-sm shadow-primary-100">
              링크 내보내기
            </button>
          </div>
        </div>

        {/* 공유 링크 */}
        <div className="max-w-[1100px] mx-auto mb-4">
          <div className="flex items-center gap-4 bg-white rounded-xl border border-surface-200 px-5 py-3">
            <Share2 size={15} className="text-bluewood-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-bluewood-700">공개 링크</span>
                <button
                  onClick={async () => {
                    setTogglingPublic(true);
                    const newVal = !isPublic;
                    try {
                      await updatePortfolio(id, { isPublic: newVal });
                      setIsPublic(newVal);
                      setPortfolio(prev => prev ? { ...prev, isPublic: newVal } : prev);
                      toast.success(newVal ? '포트폴리오가 공개되었습니다' : '공개가 해제되었습니다');
                    } catch { toast.error('공개 설정 변경 실패'); }
                    setTogglingPublic(false);
                  }}
                  disabled={togglingPublic}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isPublic ? 'bg-primary-600' : 'bg-surface-300'} ${togglingPublic ? 'opacity-50' : ''}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {isPublic && (
                <p className="text-[12px] text-bluewood-400 mt-0.5 truncate">{`${window.location.origin}/p/${activeSlug}`}</p>
              )}
            </div>
            {isPublic && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/p/${activeSlug}`);
                  setLinkCopied(true);
                  toast.success('링크가 복사되었습니다!');
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-[12px] font-semibold hover:bg-primary-700 transition-all flex-shrink-0"
              >
                {linkCopied ? '복사됨' : '링크 복사'}
              </button>
            )}
          </div>
        </div>

        <div data-tour="portfolio-preview-surface" className="w-[1100px] mx-auto border border-surface-200 rounded-2xl overflow-visible">
          <VisualPortfolioRenderer portfolio={portfolio} onOpenExpDetail={openExperienceDetail} />
        </div>

        {/* Link Export Modal */}
        {showExportModal && (
          <LinkExportModal
            portfolioId={id}
            isPublic={isPublic}
            togglingPublic={togglingPublic}
            customSlug={customSlug}
            onToggle={async () => {
              if (handleTutorialPublicToggle()) return;
              setTogglingPublic(true);
              const newVal = !isPublic;
              try {
                await updatePortfolio(id, { isPublic: newVal });
                setIsPublic(newVal);
                setPortfolio(prev => prev ? { ...prev, isPublic: newVal } : prev);
                toast.success(newVal ? '포트폴리오가 공개되었습니다' : '공개가 해제되었습니다');
              } catch { toast.error('공개 설정 변경 실패'); }
              setTogglingPublic(false);
            }}
            onClose={() => setShowExportModal(false)}
          />
        )}
        {showResumeModal && (
          <ResumeExportModal portfolio={portfolio} onClose={() => setShowResumeModal(false)} />
        )}
        {selectedExpDetail && (
          <ExperienceDetailModal
            exp={selectedExpDetail.exp}
            readOnly
            onClose={() => setSelectedExpDetail(null)}
            resizeToBase64={resizeToBase64Global}
            jobAnalysis={portfolio?.jobAnalysis}
          />
        )}
      </div>
    );
  }

  const p = portfolio;
  const contact = p.contact || {};
  const skills = p.skills || {};
  const curr = p.curricular || {};
  const extra = p.extracurricular || {};
  const getPreviewSectionOrder = makePreviewSectionOrder(p.templateId || 'notion', p.sectionOrder);

  return (
    <div className="animate-fadeIn">
      <GuidedTutorial
        ref={previewTutorialRef}
        visible={previewTutorialVisible}
        steps={previewTutorialSteps}
        onSkip={() => closePreviewTutorial(false)}
        onNeverShow={() => closePreviewTutorial(true)}
        onStepChange={setPreviewTutorialCurrentStep}
      />
      {/* Admin bar */}
      <div className="flex items-center justify-between mb-4 max-w-[1100px] mx-auto">
        <Link to="/app/portfolio" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bluewood-400 hover:text-primary-600 transition-colors">
          <ArrowLeft size={14} /> 목록으로
        </Link>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-600 ring-1 ring-amber-100">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              저장 안 됨
            </span>
          )}
          <Link to={`/app/portfolio/preview/${id}?tutorial=1`}
            className="px-4 py-2 bg-white border border-surface-200 text-bluewood-500 rounded-xl text-[13px] font-medium hover:border-primary-200 hover:text-primary-600 hover:bg-surface-50 transition-all">
            튜토리얼 보기
          </Link>
          <button data-tour="portfolio-edit" onClick={() => navigate(`/app/portfolio/edit-notion/${id}`)}
            className="px-4 py-2 bg-white border border-surface-200 text-bluewood-600 rounded-xl text-[13px] font-medium hover:border-bluewood-300 hover:bg-surface-50 transition-all">
            편집
          </button>
          <button data-tour="portfolio-ppt" onClick={() => navigate(pptExportUrl)}
            className="px-4 py-2 bg-bluewood-700 text-white rounded-xl text-[13px] font-semibold hover:bg-bluewood-800 transition-all">
            PPT 내보내기
          </button>
          <button onClick={() => setShowResumeModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[13px] font-semibold hover:bg-emerald-700 transition-all">
            이력서 내보내기
          </button>
          <button data-tour="portfolio-link" onClick={() => {
            setShowExportModal(true);
            if (previewTutorialVisible && previewTutorialCurrentStep === 1) previewTutorialRef.current?.next();
          }}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl text-[13px] font-semibold hover:bg-primary-700 transition-all shadow-sm shadow-primary-100">
            링크 내보내기
          </button>
        </div>
      </div>

      {/* 공유 링크 */}
      <div className="max-w-[1100px] mx-auto mb-4">
        <div className="flex items-center gap-4 bg-white rounded-xl border border-surface-200 px-5 py-3">
          <Share2 size={15} className="text-bluewood-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-bluewood-700">공개 링크</span>
              <button
                onClick={async () => {
                  setTogglingPublic(true);
                  const newVal = !isPublic;
                  try {
                    await updatePortfolio(id, { isPublic: newVal });
                    setIsPublic(newVal);
                    setPortfolio(prev => prev ? { ...prev, isPublic: newVal } : prev);
                    toast.success(newVal ? '포트폴리오가 공개되었습니다' : '공개가 해제되었습니다');
                  } catch { toast.error('공개 설정 변경 실패'); }
                  setTogglingPublic(false);
                }}
                disabled={togglingPublic}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isPublic ? 'bg-primary-600' : 'bg-surface-300'} ${togglingPublic ? 'opacity-50' : ''}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {isPublic && (
              <p className="text-[12px] text-bluewood-400 mt-0.5 truncate">{`${window.location.origin}/p/${activeSlug}`}</p>
            )}
          </div>
          {isPublic && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/p/${activeSlug}`);
                setLinkCopied(true);
                toast.success('링크가 복사되었습니다!');
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-[12px] font-semibold hover:bg-primary-700 transition-all flex-shrink-0"
            >
              {linkCopied ? '복사됨' : '링크 복사'}
            </button>
          )}
        </div>
      </div>

      {/* ── Template Layouts ── */}
      {(!p.templateId || p.templateId === 'notion') ? (
      <div data-tour="portfolio-preview-surface" className="max-w-[1100px] mx-auto bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden" id="notion-portfolio">

        {/* Header / Title */}
        <div className="px-10 pt-10 pb-6 border-b border-surface-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{p.headline || p.title || '포트폴리오'}</h1>
          <p className="text-xs text-gray-400">본 포트폴리오는 PC 환경에 최적화되어 있습니다.</p>
        </div>

        {/* Quick Menu - 템플릿별 차별화 */}
        <div className="px-10 py-4 border-b border-surface-100 flex gap-3 overflow-x-auto">
          {(() => {
            const hiddenSections = p.hiddenSections || [];
            const menuDefs = p.templateId === 'ashley'
              ? [['프로젝트', 'experiences'], ['기술', 'skills'], ['가치관', 'values']]
              : p.templateId === 'academic'
              ? [['학력', 'education'], ['교과 활동', 'curricular'], ['비교과 활동', 'extracurricular'], ['기술', 'skills'], ['수상 내역', 'awards'], ['목표와 계획', 'goals'], ['가치관', 'values']]
              : [['교과 활동', 'curricular'], ['비교과 활동', 'extracurricular'], ['기술', 'skills'], ['목표와 계획', 'goals'], ['가치관', 'values']];
            const dataCheck = { education: (p.education||[]).length > 0, experiences: (p.experiences||[]).length > 0, skills: !!(p.skills?.languages?.length || p.skills?.tools?.length || p.skills?.certificates?.length), curricular: (p.curricular||[]).length > 0, extracurricular: (p.extracurricular||[]).length > 0, awards: (p.awards||[]).length > 0, goals: (p.goals||[]).length > 0, values: !!(p.valuesEssay || p.valuesEssayBlocks) };
            return menuDefs
              .filter(([, key]) => !hiddenSections.includes(key) && dataCheck[key])
              .map(([label]) => (
                <a key={label} href={`#section-${label}`} onClick={e => { e.preventDefault(); const el = document.getElementById(`section-${label}`); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
                  className="px-4 py-2 bg-surface-50 hover:bg-surface-100 rounded-lg text-sm text-gray-600 font-medium whitespace-nowrap transition-colors">
                  {label}
                </a>
              ));
          })()}
        </div>

        {/* Three-column layout */}
        <div className="grid grid-cols-[260px_1fr_300px] min-h-[600px]">

          {/* ── Left: Profile ── */}
          <div className="p-6 border-r border-surface-100 bg-[#fafaf8]">
            <div className="text-xs font-bold text-gray-400 tracking-wider mb-4 border-l-2 border-primary-600 pl-2">PROFILE</div>
            {p.profileImageUrl && (
              <img src={p.profileImageUrl} alt="profile" className="w-full aspect-square object-contain bg-surface-50 rounded-xl mb-4" />
            )}
            {!p.profileImageUrl && (
              <div className="w-full aspect-square bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl mb-4 flex items-center justify-center">
                <span className="text-5xl">👤</span>
              </div>
            )}
            <h2 className="text-lg font-bold">{p.userName || '이름'}</h2>
            {p.nameEn && <p className="text-sm text-gray-500">({p.nameEn})</p>}
            {p.location && (
              <p className="flex items-center gap-1 text-sm text-gray-500 mt-2"><MapPin size={12} /> {p.location}</p>
            )}
            {p.birthDate && (
              <p className="flex items-center gap-1 text-sm text-gray-500 mt-1"><Calendar size={12} /> {p.birthDate}</p>
            )}

            {/* Values */}
            {(p.values || []).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold italic mb-3">My Own Values</h3>
                <div className="space-y-2">
                  {p.values.map((v, i) => (
                    <div key={i} className="p-2.5 bg-white rounded-lg border border-surface-100">
                      <p className="text-sm font-medium text-gray-700">
                        {v.keyword}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Center: Education, Interests ── */}
          <div className="p-6">
            {/* Education - Ashley 템플릿에서는 숨김 */}
            {p.templateId !== 'ashley' && (p.education || []).length > 0 && (
              <div className="mb-8" id="section-학력">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">Education</h3>
                <div className="space-y-6">
                  {p.education.map((edu, i) => (
                    <div key={i} className="pb-5 border-b border-surface-100 last:border-0">
                      <h4 className="text-base font-bold text-gray-900">
                        {edu.name} {edu.nameEn && <span className="font-normal text-gray-500">({edu.nameEn})</span>}
                      </h4>
                      <p className="text-sm text-gray-400 mt-1">{edu.period}</p>
                      {edu.degree && <p className="text-sm text-gray-600 mt-1">{edu.degree}</p>}
                      {edu.detail && <p className="text-sm text-gray-500 mt-1">{edu.detail}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interests */}
            {(p.interests || []).length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">Interest</h3>
                <ul className="space-y-1.5">
                  {p.interests.map((interest, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      {interest}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contact */}
            {(contact.phone || contact.email || contact.linkedin) && (
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">Contact Information</h3>
                <div className="space-y-2 text-sm">
                  {contact.phone && <p className="flex items-center gap-2 text-gray-600"><Phone size={14} /> {contact.phone}</p>}
                  {contact.email && <p className="flex items-center gap-2 text-gray-600"><Mail size={14} /> {contact.email}</p>}
                  {contact.linkedin && <p className="flex items-center gap-2 text-gray-600"><Globe size={14} /> {contact.linkedin}</p>}
                  {contact.instagram && <p className="flex items-center gap-2 text-gray-600"><Globe size={14} /> {contact.instagram}</p>}
                  {contact.github && <p className="flex items-center gap-2 text-gray-600"><Globe size={14} /> {contact.github}</p>}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Awards & Experience ── */}
          <div className="p-6 border-l border-surface-100 bg-[#fafaf8]">
            {/* Awards - Ashley 템플릿에서는 숨김 */}
            {p.templateId !== 'ashley' && (p.awards || []).length > 0 && (
              <div className="mb-8" id="section-수상 내역">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">Scholarship and Awards</h3>
                <div className="space-y-2">
                  {p.awards.map((a, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-semibold text-gray-600 underline">{a.date}</span>{' '}
                      <span className="text-gray-700">{a.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Experience (요약 목록) */}
            {(p.experiences || []).length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">Experience</h3>
                <div className="space-y-1.5">
                  {p.experiences.slice(0, 5).map((e, i) => (
                    <button key={i} onClick={() => openExperienceDetail(e, i)}
                      className="w-full text-left text-sm group hover:bg-white rounded-lg p-1 -mx-1 transition-colors">
                      <span className="font-semibold text-gray-600 underline">{e.date}</span>{' '}
                      <span className="text-gray-700">{e.title}</span>
                    </button>
                  ))}
                  {p.experiences.length > 5 && <p className="text-xs text-gray-400">외 {p.experiences.length - 5}건 — 아래 갤러리에서 확인</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Experience Gallery ── */}
        {(p.experiences || []).length > 0 && (
          <div className="px-10 py-8 border-t border-surface-100" id="section-프로젝트">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-bold pb-2 border-b-2 border-green-300 inline-block">프로젝트 / 경험</h2>
              <p className="text-xs text-gray-400">⚠️ 각 항목을 클릭하시면 소개, 참여 동기, 활동 내용에 대한 정보를 확인하실 수 있습니다.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
              {p.experiences.map((e, i) => {
                const statusMap = { expected: { label: 'Expected', cls: 'bg-blue-500' }, doing: { label: 'Doing', cls: 'bg-green-500' }, finished: { label: 'Finished', cls: 'bg-red-500' } };
                const st = statusMap[e.status] || statusMap.finished;
                const sr = e.structuredResult || {};
                const overview = sr.projectOverview || {};
                const cardSummary = '';
                const cardRole = '';
                const cardTech = [];
                const topAchievement = null;
                return (
                  <button key={i} onClick={() => openExperienceDetail(e, i)}
                    className="group bg-white rounded-xl border border-surface-200 overflow-hidden text-left hover:shadow-md hover:border-surface-300 transition-all flex flex-col">
                    {/* Thumbnail */}
                    <div className="aspect-[4/3] bg-surface-50 overflow-hidden relative flex-shrink-0">
                      {e.thumbnailUrl ? (
                        <img src={e.thumbnailUrl} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-100 to-surface-50">
                          <span className="text-4xl opacity-50">📋</span>
                        </div>
                      )}
                      {e.date && (
                        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[12px] px-1.5 py-0.5 rounded">{e.date}</span>
                      )}
                    </div>
                    {/* Card body */}
                    <div className="p-3 flex-1 flex flex-col">
                      <h4 className="text-sm font-bold text-gray-800 leading-snug mb-1">{e.title || '(제목 없음)'}</h4>
                      {cardRole && (
                        <p className="text-[11px] text-primary-600 font-medium mb-1">{cardRole}</p>
                      )}
                      {cardSummary && (
                        <p className="text-[11px] text-gray-500 leading-relaxed mb-1.5">{cardSummary}</p>
                      )}
                      {cardTech.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {cardTech.slice(0, 3).map((t, ti) => (
                            <span key={ti} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-medium border border-green-100">
                              {typeof t === 'string' ? t : t?.name || ''}
                            </span>
                          ))}
                          {cardTech.length > 3 && <span className="text-[10px] text-gray-400">+{cardTech.length - 3}</span>}
                        </div>
                      )}
                      {topAchievement && (
                        <div className="mt-auto pt-1.5 border-t border-surface-100">
                          <p className="text-[10px] text-emerald-600 font-semibold">🏆 {topAchievement.title}</p>
                          {topAchievement.metric && <p className="text-[10px] text-emerald-500">{topAchievement.metric}</p>}
                        </div>
                      )}
                      {false && !topAchievement && (e.classify || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-auto pt-1">
                          {e.classify.slice(0, 3).map((tag, ti) => (
                            <span key={ti} className="px-1.5 py-0.5 bg-surface-100 text-gray-500 rounded text-[10px]">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Full-width sections ── */}
        <div className="px-10 py-8 border-t border-surface-100 flex flex-col">

          {/* 교과 활동 - Ashley 템플릿에서는 숨김 */}
          {p.templateId !== 'ashley' && (
          <section id="section-교과 활동" className="mb-10" style={{ order: getPreviewSectionOrder('curricular') }}>
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">📝 교과 활동 | Curricular Activities</h2>
            {(curr.summary?.credits || curr.summary?.gpa) && (
              <div className="bg-surface-50 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">요약 | Summary</h4>
                {curr.summary?.credits && <p className="text-sm text-gray-700">이수 학점: {curr.summary.credits}</p>}
                {curr.summary?.gpa && <p className="text-sm text-gray-700">평점 평균: {curr.summary.gpa}</p>}
              </div>
            )}
            {(curr.courses || []).length > 0 && (
              <div>
                <h4 className="text-sm font-bold mb-2 text-gray-600">교과목 수강 내역 | Course History</h4>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-50">
                      <th className="text-left px-3 py-2 border border-surface-200">학기</th>
                      <th className="text-left px-3 py-2 border border-surface-200">과목명</th>
                      <th className="text-left px-3 py-2 border border-surface-200">성적</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curr.courses.map((c, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 border border-surface-200">{c.semester}</td>
                        <td className="px-3 py-2 border border-surface-200">{c.name}</td>
                        <td className="px-3 py-2 border border-surface-200">{c.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(curr.creditStatus || []).length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">이수 현황 | Credit Status</h4>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-50">
                      <th className="text-left px-3 py-2 border border-surface-200">구분</th>
                      <th className="text-left px-3 py-2 border border-surface-200">영역</th>
                      <th className="text-left px-3 py-2 border border-surface-200">기준학점</th>
                      <th className="text-left px-3 py-2 border border-surface-200">취득학점</th>
                      <th className="text-left px-3 py-2 border border-surface-200">잔여학점</th>
                      <th className="text-left px-3 py-2 border border-surface-200">달성률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curr.creditStatus.map((cs, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 border border-surface-200">{cs.category}</td>
                        <td className="px-3 py-2 border border-surface-200">{cs.area}</td>
                        <td className="px-3 py-2 border border-surface-200">{cs.required}</td>
                        <td className="px-3 py-2 border border-surface-200">{cs.earned}</td>
                        <td className="px-3 py-2 border border-surface-200">{cs.remaining}</td>
                        <td className="px-3 py-2 border border-surface-200">{cs.rate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          )}

          {/* 비교과 활동 - Ashley 템플릿에서는 숨김 */}
          {p.templateId !== 'ashley' && (
          <section id="section-비교과 활동" className="mb-10" style={{ order: getPreviewSectionOrder('extracurricular') }}>
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">비교과 활동 | Extracurricular Activities</h2>
            {(richValueHasContent(extra.summaryBlocks) || extra.summary) && (
              <div className="bg-surface-50 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">요약 | Summary</h4>
                {richValueHasContent(extra.summaryBlocks)
                  ? <RichTextPreview value={extra.summaryBlocks} />
                  : <p className="text-sm text-gray-700 whitespace-pre-line">{extra.summary}</p>}
              </div>
            )}
            {(extra.badges || []).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">디지털 배지 | Digital Badge</h4>
                <div className="grid grid-cols-2 gap-2">
                  {extra.badges.map((b, i) => (
                    <div key={i} className="p-3 bg-surface-50 rounded-lg border border-surface-100">
                      <p className="text-sm font-medium text-gray-800">{b.name}</p>
                      <p className="text-xs text-gray-400">{b.issuer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(extra.languages || []).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">어학 성적 | Language Certification</h4>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-50">
                      <th className="text-left px-3 py-2 border border-surface-200">시험명</th>
                      <th className="text-left px-3 py-2 border border-surface-200">점수/등급</th>
                      <th className="text-left px-3 py-2 border border-surface-200">취득일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extra.languages.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 border border-surface-200">{l.name}</td>
                        <td className="px-3 py-2 border border-surface-200">{l.score}</td>
                        <td className="px-3 py-2 border border-surface-200">{l.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(extra.details || []).length > 0 && (
              <div>
                <h4 className="text-sm font-bold mb-2 text-gray-600">세부 사항 | Details</h4>
                <div className="space-y-3">
                  {extra.details.map((d, i) => (
                    <div key={i} className="p-4 bg-surface-50 rounded-lg border border-surface-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-800">{d.title}</span>
                        <span className="text-xs text-gray-400">{d.period}</span>
                      </div>
                      {richValueHasContent(d.descriptionBlocks)
                        ? <RichTextPreview value={d.descriptionBlocks} />
                        : <p className="text-sm text-gray-600 whitespace-pre-line">{d.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
          )}

          {/* 기술 */}
          <section id="section-기술" className="mb-10" style={{ order: getPreviewSectionOrder('skills') }}>
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">기술 | Skills</h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(skills).filter(([_, arr]) => arr && arr.length > 0).map(([category, items]) => (
                <div key={category}>
                  <h4 className="text-sm font-bold text-gray-600 mb-2 capitalize">
                    {category === 'tools' ? '도구' : category === 'languages' ? '프로그래밍 언어' : category === 'frameworks' ? '프레임워크' : '기타'}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((skill, i) => {
                      const sName = typeof skill === 'string' ? skill : (skill?.name || '');
                      const sProf = typeof skill === 'string' ? 0 : (skill?.proficiency || 0);
                      return (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-800 rounded-md text-xs font-medium border border-green-100">
                          {sName}
                          {sProf > 0 && (
                            <span className="flex gap-0.5 ml-0.5">
                              {[1,2,3,4,5].map(l => (
                                <span key={l} className={`w-1 h-2.5 rounded-sm ${l <= sProf ? 'bg-green-500' : 'bg-green-200'}`} />
                              ))}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 목표와 계획 - Ashley 템플릿에서는 숨김 */}
          {p.templateId !== 'ashley' && (
          <section id="section-목표와 계획" className="mb-10" style={{ order: getPreviewSectionOrder('goals') }}>
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">✨ 목표와 계획 | Future Plans</h2>
            {(p.goals || []).length > 0 ? (
              <div className="space-y-3">
                {p.goals.map((g, i) => (
                  <div key={i} className="p-4 bg-surface-50 rounded-lg border border-surface-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        g.status === 'done' ? 'bg-green-100 text-green-700'
                          : g.status === 'ing' ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}>
                        {g.type === 'long' ? '장기' : g.type === 'mid' ? '중기' : '단기'}
                      </span>
                      <VHtml as="h4" className="text-sm font-bold text-gray-800" value={g.title} />
                      <span className={`ml-auto text-xs ${g.status === 'done' ? 'text-green-600' : g.status === 'ing' ? 'text-blue-600' : 'text-gray-400'}`}>
                        {g.status === 'done' ? '완료' : g.status === 'ing' ? '진행 중' : '예정'}
                      </span>
                    </div>
                    {richValueHasContent(g.descriptionBlocks)
                      ? <RichTextPreview value={g.descriptionBlocks} className="mt-1" />
                      : g.description && <p className="text-sm text-gray-600 mt-1">{g.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">아직 등록된 목표가 없습니다</p>
            )}
          </section>
          )}

          {/* 가치관 */}
          <section id="section-가치관" className="mb-10" style={{ order: getPreviewSectionOrder('values') }}>
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">가치관 | Values</h2>
            {richValueHasContent(p.valuesEssayBlocks) ? (
              <RichTextPreview value={p.valuesEssayBlocks} />
            ) : p.valuesEssay ? (
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                {p.valuesEssay}
              </div>
            ) : (p.values || []).length > 0 ? (
              <div className="space-y-6">
                {p.values.map((v, i) => (
                  <div key={i}>
                    <h4 className="text-base font-bold text-gray-800 mb-2">
                      {v.keyword}
                    </h4>
                    {v.description && <p className="text-sm text-gray-600 leading-relaxed">{v.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">아직 작성된 가치관이 없습니다</p>
            )}
          </section>

          {/* 자유 블록 — 항상 고정 섹션 뒤(맨 아래)에 배열 순서대로 표시 */}
          {(p.customBlocks || []).map((block, i) => (
            hasCustomBlockContent(block) ? (
              <section key={`cb-${i}`} className="mb-10" style={{ order: 1000 + i }}>
                <CustomPortfolioBlocks blocks={[block]} variant="notion-bare" onOpenCard={(card) => openExperienceDetail(card)} />
              </section>
            ) : null
          ))}
        </div>

        {/* Footer */}
        <div className="px-10 py-4 bg-surface-50 border-t border-surface-100 flex items-center justify-between text-xs text-gray-400">
          <span>FitPoly Portfolio · {p.userName || ''}</span>
          <a href="#notion-portfolio" className="flex items-center gap-1 hover:text-gray-600">맨 위로 <ChevronUp size={12} /></a>
        </div>
      </div>
      ) : p.templateId === 'academic' ? (
        <AcademicLayout p={p} setSelectedExp={openExperienceDetail} />
      ) : p.templateId === 'timeline' ? (
        <TimelineLayout p={p} setSelectedExp={openExperienceDetail} />
      ) : (
        <AshleyLayout p={p} setSelectedExp={openExperienceDetail} />
      )}

      {/* Link Export Modal */}
      {showExportModal && (
        <LinkExportModal
          portfolioId={id}
          isPublic={isPublic}
          togglingPublic={togglingPublic}
          customSlug={customSlug}
          onToggle={async () => {
            if (handleTutorialPublicToggle()) return;
            setTogglingPublic(true);
            const newVal = !isPublic;
            try {
              await updatePortfolio(id, { isPublic: newVal });
              setIsPublic(newVal);
              setPortfolio(prev => prev ? { ...prev, isPublic: newVal } : prev);
              toast.success(newVal ? '포트폴리오가 공개되었습니다' : '공개가 해제되었습니다');
            } catch { toast.error('공개 설정 변경 실패'); }
            setTogglingPublic(false);
          }}
          onClose={() => setShowExportModal(false)}
        />
      )}
      {showResumeModal && (
        <ResumeExportModal portfolio={portfolio} onClose={() => setShowResumeModal(false)} />
      )}

      {/* Experience Detail Modal */}
      {selectedExpDetail && (
        <ExperienceDetailModal
          exp={selectedExpDetail.exp}
          readOnly
          onClose={() => setSelectedExpDetail(null)}
          resizeToBase64={resizeToBase64Global}
          jobAnalysis={portfolio?.jobAnalysis}
        />
      )}
    </div>
  );
}

// ── Link Export Modal ──
function LinkExportModal({ portfolioId, isPublic, togglingPublic, customSlug, onToggle, onClose }) {
  const [copied, setCopied] = useState(false);

  const activeSlug = customSlug || portfolioId;
  const publicUrl = `${window.location.origin}/p/${activeSlug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('링크가 복사되었습니다!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-100">
          <h2 className="text-lg font-bold">링크 내보내기</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-surface-50">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 공개 링크 토글 */}
          <div className="flex items-center justify-between p-4 bg-surface-50 rounded-xl border border-surface-100">
            <div>
              <p className="text-sm font-semibold text-gray-800">공개 링크 활성화</p>
              <p className="text-xs text-gray-400 mt-0.5">누구나 링크로 포트폴리오를 확인할 수 있어요</p>
            </div>
            <button
              data-tour="portfolio-public-toggle"
              onClick={onToggle}
              disabled={togglingPublic}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublic ? 'bg-primary-500' : 'bg-gray-300'} ${togglingPublic ? 'opacity-50' : ''}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* 링크 표시 및 복사 */}
          {isPublic ? (
            <>
              <div className="p-3 bg-primary-50 rounded-xl border border-primary-100">
                <span className="text-sm text-primary-700 truncate block font-mono">{publicUrl}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  {copied ? '복사됨!' : '링크 복사'}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 border border-surface-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-surface-50 transition-colors"
                >
                  열기
                </a>
              </div>
            </>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-700">
                공개 링크를 활성화하면 링크를 아는 누구나 포트폴리오를 볼 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function collectRichText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collectRichText).join('');
  if (typeof node === 'object') {
    return [node.text, collectRichText(node.children), collectRichText(node.value)]
      .filter(Boolean)
      .join('');
  }
  return '';
}

function richValueToPlainText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(item => item?.content || '').filter(Boolean).join('\n');
  if (typeof value === 'object') {
    return Object.values(value)
      .sort((a, b) => (a?.meta?.order ?? 0) - (b?.meta?.order ?? 0))
      .map(block => collectRichText(block?.value || block))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function richValueHasContent(value) {
  if (!value) return false;
  if (Array.isArray(value)) {
    return value.some(item => item?.type === 'image' || String(item?.content || '').trim());
  }
  if (typeof value === 'object') {
    return Object.values(value).some(block => {
      if (block?.type === 'Image') {
        const firstValue = Array.isArray(block.value) ? block.value[0] : null;
        return !!(firstValue?.props?.src || block?.props?.src);
      }
      return collectRichText(block?.value || block).trim().length > 0;
    });
  }
  return richValueToPlainText(value).trim().length > 0;
}

function RichTextPreview({ value, className = '' }) {
  if (!richValueHasContent(value)) return null;
  if (typeof value === 'string' || Array.isArray(value)) {
    return <div className={`space-y-2 ${className}`}>{String(richValueToPlainText(value)).split('\n').filter(Boolean).map((line, i) => <p key={i} className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{line}</p>)}</div>;
  }

  const blocks = Object.values(value)
    .sort((a, b) => (a?.meta?.order ?? 0) - (b?.meta?.order ?? 0));

  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, index) => {
        const text = collectRichText(block?.value || block);
        const firstValue = Array.isArray(block?.value) ? block.value[0] : null;
        const checked = !!(firstValue?.props?.checked ?? firstValue?.checked ?? block?.props?.checked);

        if (block.type === 'Divider') return <hr key={block.id || index} className="my-4 border-surface-200" />;
        if (block.type === 'Image') {
          const props = firstValue?.props || block.props || {};
          const src = props.src || props.url || props.href;
          return src ? <img key={block.id || index} src={src} alt={props.alt || ''} className="my-4 max-w-full rounded-xl border border-surface-100 object-contain" /> : null;
        }
        if (!text.trim()) return null;
        if (block.type === 'HeadingOne') return <h1 key={block.id || index} className="text-2xl font-extrabold leading-snug text-gray-900">{text}</h1>;
        if (block.type === 'HeadingTwo') return <h2 key={block.id || index} className="text-xl font-bold leading-snug text-gray-900">{text}</h2>;
        if (block.type === 'HeadingThree') return <h3 key={block.id || index} className="text-base font-bold leading-snug text-gray-800">{text}</h3>;
        if (block.type === 'BulletedList') return <div key={block.id || index} className="flex gap-2 text-sm leading-relaxed text-gray-700"><span className="text-gray-400">•</span><span>{text}</span></div>;
        if (block.type === 'NumberedList') return <div key={block.id || index} className="flex gap-2 text-sm leading-relaxed text-gray-700"><span className="min-w-[1.5rem] text-right font-semibold text-gray-400">{index + 1}.</span><span>{text}</span></div>;
        if (block.type === 'TodoList') {
          return (
            <div key={block.id || index} className="flex items-start gap-2 text-sm leading-relaxed text-gray-700">
              <span className={`mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 bg-white'}`}>
                {checked ? '✓' : ''}
              </span>
              <span className={checked ? 'text-gray-400 line-through' : ''}>{text}</span>
            </div>
          );
        }
        if (block.type === 'Blockquote') return <blockquote key={block.id || index} className="border-l-4 border-gray-300 pl-4 text-sm italic leading-relaxed text-gray-600">{text}</blockquote>;
        if (block.type === 'Callout') return <div key={block.id || index} className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">{text}</div>;
        if (block.type === 'Code') return <pre key={block.id || index} className="overflow-x-auto rounded-lg bg-gray-950 px-4 py-3 text-[13px] leading-relaxed text-gray-100"><code>{text}</code></pre>;
        return <p key={block.id || index} className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{text}</p>;
      })}
    </div>
  );
}

function hasCustomBlockContent(block) {
  if (!block) return false;
  if (block.type === 'divider') return true;
  if (block.type === 'project') return Array.isArray(block.content) && block.content.length > 0;
  if (Array.isArray(block.segments)) return block.segments.some(seg => String(seg?.content || '').trim());
  return String(block.content || '').trim().length > 0;
}

function renderCustomBlockSegments(block, textClassName) {
  const segments = Array.isArray(block.segments) && block.segments.length > 0
    ? block.segments
    : block.type === 'image'
      ? [{ type: 'image', content: block.content, width: block.width }]
      : [{ type: 'text', content: block.content }];

  return segments.map((seg, index) => {
    if (seg.type === 'image' && seg.content) {
      return (
        <img
          key={index}
          src={seg.content}
          alt=""
          className="my-4 max-w-full rounded-xl border border-surface-100 object-contain"
          style={{ width: seg.width || '100%' }}
        />
      );
    }
    if (!String(seg.content || '').trim()) return null;
    const variant = seg.variant || 'paragraph';
    if (variant === 'heading1') return <h1 key={index} className="text-2xl font-extrabold leading-snug text-gray-900">{seg.content}</h1>;
    if (variant === 'heading2') return <h2 key={index} className="text-xl font-bold leading-snug text-gray-900">{seg.content}</h2>;
    if (variant === 'heading3') return <h3 key={index} className="text-base font-bold leading-snug text-gray-800">{seg.content}</h3>;
    if (variant === 'bullet') return <div key={index} className={`flex gap-2 ${textClassName}`}><span className="text-gray-400">•</span><span>{seg.content}</span></div>;
    if (variant === 'numbered') return <div key={index} className={`flex gap-2 ${textClassName}`}><span className="min-w-[1.5rem] text-right font-semibold text-gray-400">{index + 1}.</span><span>{seg.content}</span></div>;
    if (variant === 'todo') {
      return (
        <div key={index} className={`flex items-start gap-2 ${textClassName}`}>
          <span className={`mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${seg.checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 bg-white'}`}>
            {seg.checked ? '✓' : ''}
          </span>
          <span className={seg.checked ? 'text-gray-400 line-through' : ''}>{seg.content}</span>
        </div>
      );
    }
    if (variant === 'quote') return <blockquote key={index} className={`${textClassName} border-l-4 border-gray-300 pl-4 italic text-gray-600`}>{seg.content}</blockquote>;
    if (variant === 'callout') return <div key={index} className={`${textClassName} rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-amber-900`}>{seg.content}</div>;
    if (variant === 'code') return <pre key={index} className="overflow-x-auto rounded-lg bg-gray-950 px-4 py-3 text-[13px] leading-relaxed text-gray-100"><code>{seg.content}</code></pre>;
    return <p key={index} className={textClassName}>{seg.content}</p>;
  });
}

function CustomPortfolioBlocks({ blocks, variant = 'notion', onOpenCard }) {
  const visibleBlocks = (blocks || []).filter(hasCustomBlockContent);
  if (visibleBlocks.length === 0) return null;

  const warm = variant === 'ashley';
  const dark = variant === 'timeline';
  const bare = variant === 'notion-bare'; // 밴드 안에 개별 배치될 때: 외부 패딩/구분선 제거
  const outerClass = warm
    ? 'px-10 pb-8 space-y-4'
    : dark
      ? 'px-8 py-6 border-b border-surface-100 space-y-5'
      : bare
        ? 'space-y-5'
        : 'px-10 py-8 border-b border-surface-100 space-y-5';
  const cardClass = warm
    ? 'rounded-xl border border-[#e8e4dc] bg-white p-6'
    : dark
      ? 'rounded-xl border border-surface-200 bg-white p-5'
      : 'rounded-xl border border-surface-200 bg-white p-5';
  const titleClass = warm
    ? 'text-xl font-bold text-[#2d2a26] leading-snug'
    : 'text-xl font-bold text-gray-900 leading-snug';
  const textClass = warm
    ? 'text-sm text-[#5a564e] leading-[1.85] whitespace-pre-line'
    : 'text-sm text-gray-700 leading-[1.85] whitespace-pre-line';

  return (
    <div className={outerClass}>
      {visibleBlocks.map((block, index) => {
        if (block.type === 'divider') return <hr key={index} className={warm ? 'border-[#e8e4dc]' : 'border-surface-200'} />;
        if (block.type === 'heading') return <VHtml key={index} as="h2" className={titleClass} value={block.content} />;
        if (block.type === 'project') {
          const cards = Array.isArray(block.content) ? block.content : [];
          return (
            <div key={index} className={cardClass}>
              {block.title && <VHtml as="h2" className={`${titleClass} mb-4`} value={block.title} />}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cards.map((card, cardIndex) => {
                  const body = (
                    <>
                      <img src={card.thumbnailUrl || DEFAULT_PROJECT_LOGO} alt="" className="mb-3 aspect-[16/9] w-full rounded-lg object-cover" />
                      <div className="flex items-start justify-between gap-3">
                        <VHtml as="h3" className={warm ? 'text-sm font-bold text-[#2d2a26]' : 'text-sm font-bold text-gray-900'} value={card.title || '프로젝트'} />
                        {card.link && <ExternalLink size={13} className={warm ? 'text-[#c4a882]' : 'text-gray-400'} />}
                      </div>
                      {false && card.date && <p className={warm ? 'mt-1 text-xs text-[#8a8578]' : 'mt-1 text-xs text-gray-400'}>{card.date}</p>}
                      {false && card.description && <p className={warm ? 'mt-2 text-xs leading-relaxed text-[#5a564e]' : 'mt-2 text-xs leading-relaxed text-gray-600'}>{card.description}</p>}
                    </>
                  );
                  return card.link ? (
                    <a key={cardIndex} href={card.link} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-surface-100 p-4 transition hover:shadow-md">
                      {body}
                    </a>
                  ) : onOpenCard ? (
                    <button key={cardIndex} type="button" onClick={() => onOpenCard(card)} className="block w-full text-left rounded-xl border border-surface-100 p-4 transition hover:shadow-md cursor-pointer">
                      {body}
                    </button>
                  ) : (
                    <div key={cardIndex} className="rounded-xl border border-surface-100 p-4">{body}</div>
                  );
                })}
              </div>
            </div>
          );
        }
        return <div key={index} className={cardClass}>{renderCustomBlockSegments(block, textClass)}</div>;
      })}
    </div>
  );
}

// ── Academic Layout (학생 이력서 - 클린 그라데이션 헤더 + 타임라인) ──
function AcademicLayout({ p, setSelectedExp }) {
  const contact = p.contact || {};
  const skills = p.skills || {};
  const curr = p.curricular || {};
  const extra = p.extracurricular || {};
  const getPreviewSectionOrder = makePreviewSectionOrder('academic', p.sectionOrder);

  return (
    <div data-tour="portfolio-preview-surface" className="max-w-[900px] mx-auto" id="notion-portfolio">
      {/* Hero Banner */}
      <div className="relative rounded-t-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 20% 50%, #60a5fa 0%, transparent 50%), radial-gradient(circle at 80% 50%, #818cf8 0%, transparent 50%)'}} />
        <div className="relative px-10 pt-12 pb-10 flex items-end gap-6">
          {p.profileImageUrl ? (
            <img src={p.profileImageUrl} alt="profile" className="w-28 h-28 rounded-2xl object-contain bg-surface-50 border-4 border-white/20 shadow-lg" />
          ) : (
            <div className="w-28 h-28 rounded-2xl bg-white/10 border-4 border-white/20 flex items-center justify-center text-5xl">👤</div>
          )}
          <div className="flex-1 pb-1">
            <VHtml as="h1" className="text-3xl font-bold text-white mb-1" value={p.userName || '이름'} />
            {p.nameEn && <VHtml as="p" className="text-blue-200 text-sm" value={p.nameEn} />}
            <VHtml as="p" className="text-blue-300/70 text-xs mt-2" value={p.headline || p.title || ''} />
          </div>
          <div className="pb-1 text-right">
            {p.location && <p className="text-blue-200/60 text-xs flex items-center gap-1 justify-end"><MapPin size={11} /> {p.location}</p>}
            {p.birthDate && <p className="text-blue-200/60 text-xs flex items-center gap-1 justify-end mt-1"><Calendar size={11} /> {p.birthDate}</p>}
          </div>
        </div>
        {/* Quick Nav */}
        <div className="flex gap-2 px-10 pb-4 overflow-x-auto">
          {['소개','학력','경험','기술','수상','교과','비교과','목표'].map(m => (
            <a key={m} href={`#acad-${m}`} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white/80 font-medium whitespace-nowrap transition-colors">{m}</a>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-b-2xl border border-t-0 border-surface-200 shadow-sm">
        {/* About / Values */}
        <div className="px-10 py-8 border-b border-surface-100" id="acad-소개">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block" /> 자기소개
          </h2>
          {richValueHasContent(p.valuesEssayBlocks) ? (
            <RichTextPreview value={p.valuesEssayBlocks} />
          ) : p.valuesEssay ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{p.valuesEssay}</p>
          ) : (p.values || []).length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {p.values.map((v, i) => (
                <div key={i} className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <p className="text-sm font-bold text-blue-900 mb-1">{v.keyword}</p>
                  {v.description && <p className="text-xs text-blue-700/70 leading-relaxed">{v.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">아직 소개가 작성되지 않았습니다.</p>
          )}
        </div>

        {/* Contact Bar */}
        {(contact.phone || contact.email || contact.github || contact.linkedin) && (
          <div className="px-10 py-4 border-b border-surface-100 flex flex-wrap gap-4 bg-surface-50/50">
            {contact.email && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Mail size={12} className="text-gray-400" /> {contact.email}</span>}
            {contact.phone && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Phone size={12} className="text-gray-400" /> {contact.phone}</span>}
            {contact.github && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Globe size={12} className="text-gray-400" /> {contact.github}</span>}
            {contact.linkedin && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Globe size={12} className="text-gray-400" /> {contact.linkedin}</span>}
          </div>
        )}

        {/* Education + Awards side by side */}
        <div className="px-10 py-8 border-b border-surface-100" id="acad-학력">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-8">
            {/* Education */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-500 rounded-full inline-block" /> 학력
              </h2>
              <div className="space-y-4 relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-emerald-100" />
                {(p.education || []).map((edu, i) => (
                  <div key={i} className="flex items-start gap-3 relative">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white z-10 mt-0.5 flex-shrink-0" />
                    <div>
                      <VHtml as="h4" className="text-sm font-bold text-gray-800" value={edu.name} />
                      {edu.degree && <VHtml as="p" className="text-xs text-gray-500" value={edu.degree} />}
                      <VHtml as="p" className="text-xs text-gray-400 mt-0.5" value={edu.period} />
                      {edu.detail && <VHtml as="p" className="text-xs text-gray-500 mt-1" value={edu.detail} />}
                    </div>
                  </div>
                ))}
                {(p.education || []).length === 0 && <p className="text-xs text-gray-400 ml-6">학력 정보가 없습니다</p>}
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-surface-200" />

            {/* Awards */}
            <div id="acad-수상">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-amber-500 rounded-full inline-block" /> 수상 / 장학금
              </h2>
              <div className="space-y-3">
                {(p.awards || []).map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div>
                      <VHtml as="p" className="text-sm font-medium text-gray-800" value={a.title} />
                      <VHtml as="p" className="text-xs text-gray-400" value={a.date} />
                    </div>
                  </div>
                ))}
                {(p.awards || []).length === 0 && <p className="text-xs text-gray-400">수상 내역이 없습니다</p>}
              </div>
            </div>
          </div>
        </div>

        {/* 활동 기록 (타임라인) */}
        {(p.activityRecords || []).length > 0 && (
          <div className="px-10 py-8 border-b border-surface-100" id="acad-활동기록">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block" /> 활동 기록
            </h2>
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-blue-100" />
              <div className="space-y-4">
                {p.activityRecords.map((act, i) => {
                  const catColors = {
                    award: 'bg-amber-400', study: 'bg-purple-400', project: 'bg-blue-400',
                    intern: 'bg-green-400', certificate: 'bg-red-400', volunteer: 'bg-pink-400', other: 'bg-gray-400',
                  };
                  return (
                    <div key={i} className="flex items-start gap-3 relative">
                      <div className={`w-3.5 h-3.5 rounded-full ${catColors[act.category] || 'bg-gray-400'} border-2 border-white z-10 mt-0.5 flex-shrink-0`} />
                      <div className="flex-1">
                        <VHtml as="h4" className="text-sm font-medium text-gray-800" value={act.title || '(제목 없음)'} />
                        <VHtml as="p" className="text-xs text-gray-400 mt-0.5" value={act.date || ''} />
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 rounded-md px-2 py-0.5">{act.category || 'other'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Experiences */}
        {(p.experiences || []).length > 0 && (
          <div className="px-10 py-8 border-b border-surface-100" id="acad-경험">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-violet-500 rounded-full inline-block" /> 프로젝트 / 경험
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {p.experiences.map((e, i) => {
                const stMap = { expected: 'bg-blue-500', doing: 'bg-green-500', finished: 'bg-gray-400' };
                const sr = e.structuredResult || {};
                const overview = sr.projectOverview || {};
                const cardSummary = '';
                const cardRole = '';
                const cardTech = [];
                return (
                  <button key={i} onClick={() => setSelectedExp(e)}
                    className="group text-left bg-white rounded-xl border border-surface-200 overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all flex flex-col">
                    <div className="aspect-[16/10] bg-gradient-to-br from-slate-100 to-blue-50 overflow-hidden relative flex-shrink-0">
                      {e.thumbnailUrl ? (
                        <img src={e.thumbnailUrl} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><span className="text-3xl opacity-40">📋</span></div>
                      )}
                      <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${stMap[e.status] || stMap.finished}`} />
                    </div>
                    <div className="p-3 flex-1 flex flex-col">
                      <VHtml as="h4" className="text-sm font-bold text-gray-800 mb-1" value={e.title || '(제목 없음)'} />
                      {false && <p className="text-xs text-gray-400">{e.date || ''}</p>}
                      {cardRole && <p className="text-[11px] text-violet-600 font-medium mt-1">{cardRole}</p>}
                      {cardSummary && <p className="text-[11px] text-gray-500 leading-relaxed mt-1">{cardSummary}</p>}
                      {cardTech.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {cardTech.slice(0, 3).map((t, ti) => (
                            <span key={ti} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">{typeof t === 'string' ? t : t?.name || ''}</span>
                          ))}
                        </div>
                      )}
                      {false && cardTech.length === 0 && (e.classify || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">{e.classify.slice(0, 3).map((t, ti) => (
                          <span key={ti} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[12px]">{t}</span>
                        ))}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col">

        {/* Skills */}
        <div className="px-10 py-8 border-b border-surface-100" id="acad-기술" style={{ order: getPreviewSectionOrder('skills') }}>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-teal-500 rounded-full inline-block" /> 기술
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(skills).filter(([_, arr]) => arr && arr.length > 0).map(([category, items]) => (
              <div key={category} className="p-4 bg-surface-50 rounded-xl">
                <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
                  {category === 'tools' ? '도구' : category === 'languages' ? '언어' : category === 'frameworks' ? '프레임워크' : '기타'}
                </h4>
                <div className="space-y-2">
                  {items.map((skill, i) => {
                    const sName = typeof skill === 'string' ? skill : (skill?.name || '');
                    const sProf = typeof skill === 'string' ? 0 : (skill?.proficiency || 0);
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{sName}</span>
                        {sProf > 0 && (
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(l => (
                              <div key={l} className={`w-4 h-1.5 rounded-full ${l <= sProf ? 'bg-teal-500' : 'bg-gray-200'}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Curricular */}
        {(curr.courses?.length > 0 || curr.summary?.credits || curr.summary?.gpa) && (
          <div className="px-10 py-8 border-b border-surface-100" id="acad-교과" style={{ order: getPreviewSectionOrder('curricular') }}>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-orange-500 rounded-full inline-block" /> 교과 활동
            </h2>
            {(curr.summary?.credits || curr.summary?.gpa) && (
              <div className="flex gap-4 mb-4">
                {curr.summary.credits && <div className="px-4 py-3 bg-orange-50 rounded-xl"><p className="text-xs text-orange-600 font-medium">이수 학점</p><p className="text-lg font-bold text-orange-800">{curr.summary.credits}</p></div>}
                {curr.summary.gpa && <div className="px-4 py-3 bg-orange-50 rounded-xl"><p className="text-xs text-orange-600 font-medium">평점 평균</p><p className="text-lg font-bold text-orange-800">{curr.summary.gpa}</p></div>}
              </div>
            )}
            {(curr.courses || []).length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-surface-50"><th className="text-left px-3 py-2 border border-surface-200 text-xs font-medium text-gray-500">학기</th><th className="text-left px-3 py-2 border border-surface-200 text-xs font-medium text-gray-500">과목명</th><th className="text-left px-3 py-2 border border-surface-200 text-xs font-medium text-gray-500">성적</th></tr></thead>
                <tbody>{curr.courses.map((c, i) => (<tr key={i}><td className="px-3 py-2 border border-surface-200 text-xs">{c.semester}</td><td className="px-3 py-2 border border-surface-200 text-xs">{c.name}</td><td className="px-3 py-2 border border-surface-200 text-xs">{c.grade}</td></tr>))}</tbody>
              </table>
            )}
          </div>
        )}

        {/* Extracurricular */}
        {(extra.details?.length > 0 || extra.badges?.length > 0 || extra.languages?.length > 0 || richValueHasContent(extra.summaryBlocks) || extra.summary) && (
          <div className="px-10 py-8 border-b border-surface-100" id="acad-비교과" style={{ order: getPreviewSectionOrder('extracurricular') }}>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-pink-500 rounded-full inline-block" /> 비교과 활동
            </h2>
            {richValueHasContent(extra.summaryBlocks)
              ? <RichTextPreview value={extra.summaryBlocks} className="mb-4" />
              : extra.summary && <p className="text-sm text-gray-600 mb-4 leading-relaxed whitespace-pre-line">{extra.summary}</p>}
            {(extra.badges || []).length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 mb-2">디지털 배지</h4>
                <div className="flex flex-wrap gap-2">{extra.badges.map((b, i) => (
                  <span key={i} className="px-3 py-1.5 bg-pink-50 text-pink-700 rounded-lg text-xs font-medium border border-pink-100">{b.name}</span>
                ))}</div>
              </div>
            )}
            {(extra.languages || []).length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 mb-2">어학</h4>
                <div className="flex flex-wrap gap-2">{extra.languages.map((l, i) => (
                  <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs border border-indigo-100">{l.name} {l.score}</span>
                ))}</div>
              </div>
            )}
            {(extra.details || []).length > 0 && (
              <div className="space-y-3">{extra.details.map((d, i) => (
                <div key={i} className="p-4 bg-surface-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-800">{d.title}</span>
                    <span className="text-xs text-gray-400">{d.period}</span>
                  </div>
                  {richValueHasContent(d.descriptionBlocks)
                    ? <RichTextPreview value={d.descriptionBlocks} />
                    : <p className="text-xs text-gray-600 whitespace-pre-line">{d.description}</p>}
                </div>
              ))}</div>
            )}
          </div>
        )}

        {/* Goals */}
        {(p.goals || []).length > 0 && (
          <div className="px-10 py-8 border-b border-surface-100" id="acad-목표" style={{ order: getPreviewSectionOrder('goals') }}>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-cyan-500 rounded-full inline-block" /> 목표와 계획
            </h2>
            <div className="space-y-3">
              {p.goals.map((g, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                    g.status === 'done' ? 'bg-green-500' : g.status === 'ing' ? 'bg-blue-500' : 'bg-gray-400'
                  }`}>{g.status === 'done' ? '✓' : g.status === 'ing' ? '→' : '○'}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 text-gray-500 font-medium">{g.type === 'long' ? '장기' : g.type === 'mid' ? '중기' : '단기'}</span>
                      <VHtml as="h4" className="text-sm font-bold text-gray-800" value={g.title} />
                    </div>
                    {richValueHasContent(g.descriptionBlocks)
                      ? <RichTextPreview value={g.descriptionBlocks} className="mt-1" />
                      : g.description && <p className="text-xs text-gray-500 mt-1">{g.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>

        <CustomPortfolioBlocks blocks={p.customBlocks} variant="academic" onOpenCard={setSelectedExp} />

        {/* Footer */}
        <div className="px-10 py-4 bg-surface-50 flex items-center justify-between text-xs text-gray-400 rounded-b-2xl">
          <span>FitPoly Portfolio · {p.userName || ''}</span>
          <a href="#notion-portfolio" className="hover:text-gray-600">맨 위로 ↑</a>
        </div>
      </div>
    </div>
  );
}

// ── Ashley Layout (크리에이티브 - 따뜻한 스크롤형 포트폴리오) ──
function AshleyLayout({ p, setSelectedExp }) {
  const contact = p.contact || {};
  const skills = p.skills || {};
  const getPreviewSectionOrder = makePreviewSectionOrder('ashley', p.sectionOrder);

  return (
    <div data-tour="portfolio-preview-surface" className="max-w-[860px] mx-auto" id="notion-portfolio">
      {/* Hero */}
      <div className="bg-[#f7f5f0] rounded-2xl border border-[#e8e4dc] shadow-sm overflow-hidden">
        <div className="px-10 pt-10 pb-8">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <VHtml as="h1" className="text-4xl font-bold text-[#2d2a26] mb-2 tracking-tight" value={p.userName || '이름'} />
              {p.nameEn && <VHtml as="p" className="text-[#8a8578] text-sm mb-3" value={p.nameEn} />}
              <VHtml as="p" className="text-[#5a564e] text-sm leading-relaxed" value={p.headline || p.title || ''} />
              <div className="flex items-center gap-4 mt-4 text-xs text-[#8a8578]">
                {contact.email && <span>{contact.email}</span>}
                {contact.instagram && <span>Instagram</span>}
                {contact.github && <span>GitHub</span>}
              </div>
            </div>
            {p.profileImageUrl ? (
              <img src={p.profileImageUrl} alt="profile" className="w-24 h-24 rounded-2xl object-contain bg-surface-50 shadow-md" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-[#e8e4dc] flex items-center justify-center text-4xl shadow-md">👤</div>
            )}
          </div>
        </div>

        {/* 한눈에 보기 + 저는 이런 사람이에요 */}
        <div className="px-10 pb-8">
          <div className="grid grid-cols-2 gap-4">
            {/* 한눈에 보기 */}
            <div className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
              <h3 className="font-bold text-sm text-[#2d2a26] mb-4 flex items-center gap-2">📋 한눈에 보기</h3>
              <div className="space-y-3 text-sm">
                {p.location && <div className="flex justify-between"><span className="text-[#8a8578]">위치</span><span className="font-medium text-[#2d2a26]">{p.location}</span></div>}
                {p.birthDate && <div className="flex justify-between"><span className="text-[#8a8578]">생년월일</span><span className="font-medium text-[#2d2a26]">{p.birthDate}</span></div>}
                {contact.email && <div className="flex justify-between"><span className="text-[#8a8578]">이메일</span><span className="font-medium text-[#2d2a26] text-xs">{contact.email}</span></div>}
                {contact.phone && <div className="flex justify-between"><span className="text-[#8a8578]">연락처</span><span className="font-medium text-[#2d2a26]">{contact.phone}</span></div>}
                {(p.education || []).length > 0 && <div className="flex justify-between"><span className="text-[#8a8578]">학교</span><VHtml className="font-medium text-[#2d2a26] text-xs text-right" value={p.education[0].name} /></div>}
              </div>
            </div>
            {/* 저는 이런 사람이에요 */}
            <div className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
              <h3 className="font-bold text-sm text-[#2d2a26] mb-4 flex items-center gap-2">✨ 저는 이런 사람이에요</h3>
              {(p.values || []).length > 0 ? (
                <ul className="space-y-2.5">
                  {p.values.map((v, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#5a564e]">
                      <span className="w-2 h-2 bg-[#c4a882] rounded-full mt-1.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-[#2d2a26]">{v.keyword}</span>
                        {v.description && <span className="text-[#8a8578]"> — {v.description}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : richValueHasContent(p.valuesEssayBlocks) ? (
                <RichTextPreview value={p.valuesEssayBlocks} />
              ) : p.valuesEssay ? (
                <p className="text-sm text-[#5a564e] leading-relaxed whitespace-pre-line line-clamp-6">{p.valuesEssay}</p>
              ) : (
                <p className="text-sm text-[#8a8578]">가치관 정보가 없습니다.</p>
              )}
            </div>
          </div>
        </div>

        {/* 인터뷰 섹션 (경험 기반) */}
        {(p.experiences || []).length > 0 && (
          <div className="px-10 pb-8">
            <div className="bg-white rounded-xl p-6 border border-[#e8e4dc]">
              <h3 className="font-bold text-lg text-[#2d2a26] mb-5">인터뷰</h3>
              <div className="space-y-5">
                {p.experiences.slice(0, 3).map((e, i) => (
                  <div key={i} className="flex gap-5 cursor-pointer group" onClick={() => setSelectedExp(e)}>
                    <div className="flex-1">
                      <p className="font-medium text-[#2d2a26] text-sm mb-1 group-hover:text-[#c4a882] transition-colors">Q. <VHtml value={e.title} />에 대해 이야기해주세요.</p>
                      <p className="text-sm text-[#8a8578] leading-relaxed">{e.description || (e.sections || []).find(s => s.content)?.content || '클릭하여 자세한 내용을 확인하세요.'}</p>
                    </div>
                    {e.thumbnailUrl && (
                      <img src={e.thumbnailUrl} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0 group-hover:shadow-md transition-shadow" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 프로젝트 갤러리 */}
        {(p.experiences || []).length > 0 && (
          <div className="px-10 pb-8">
            <h3 className="font-bold text-lg text-[#2d2a26] mb-4">프로젝트</h3>
            <div className="grid grid-cols-3 gap-4">
              {p.experiences.map((e, i) => {
                const sr = e.structuredResult || {};
                const overview = sr.projectOverview || {};
                const cardSummary = '';
                const cardRole = '';
                return (
                <button key={i} onClick={() => setSelectedExp(e)}
                  className="group text-left bg-white rounded-xl border border-[#e8e4dc] overflow-hidden hover:shadow-lg transition-all flex flex-col">
                  <div className="aspect-[4/3] bg-[#f0ece4] overflow-hidden flex-shrink-0">
                    {e.thumbnailUrl ? (
                      <img src={e.thumbnailUrl} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">{['🎯','📱','🎨','💡','📊','🚀'][i % 6]}</div>
                    )}
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <VHtml as="h4" className="text-sm font-bold text-[#2d2a26] mb-1" value={e.title || '(제목 없음)'} />
                    {false && <p className="text-xs text-[#8a8578]">{e.date || ''}</p>}
                    {cardRole && <p className="text-[11px] text-[#c4a882] font-medium mt-1">{cardRole}</p>}
                    {cardSummary && <p className="text-[11px] text-[#8a8578] leading-relaxed mt-1">{cardSummary}</p>}
                    {false && (e.classify || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-auto pt-1.5">{e.classify.slice(0, 2).map((t, ti) => (
                        <span key={ti} className="px-1.5 py-0.5 bg-[#f7f5f0] text-[#8a8578] rounded text-[10px]">{t}</span>
                      ))}</div>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col">

        {/* 이런 일을 할 수 있어요 (Skills) */}
        <div className="px-10 pb-8" style={{ order: getPreviewSectionOrder('skills') }}>
          <h3 className="font-bold text-lg text-[#2d2a26] mb-4">💼 이런 일을 할 수 있어요</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(skills).filter(([_, arr]) => arr && arr.length > 0).map(([category, items]) => (
              <div key={category} className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
                <h4 className="text-xs font-bold text-[#8a8578] mb-3 uppercase tracking-wider">
                  {category === 'tools' ? '도구' : category === 'languages' ? '프로그래밍' : category === 'frameworks' ? '프레임워크' : '기타'}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {items.map((skill, i) => {
                    const sName = typeof skill === 'string' ? skill : (skill?.name || '');
                    const sProf = typeof skill === 'string' ? 0 : (skill?.proficiency || 0);
                    return (
                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f7f5f0] text-[#5a564e] rounded-full text-xs font-medium">
                        {sName}
                        {sProf > 0 && <span className="flex gap-0.5 ml-0.5">{[1,2,3,4,5].map(l => (
                          <span key={l} className={`w-1 h-2.5 rounded-sm ${l <= sProf ? 'bg-[#c4a882]' : 'bg-[#e8e4dc]'}`} />
                        ))}</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 가치관 에세이 (긴 글) */}
        {(richValueHasContent(p.valuesEssayBlocks) || p.valuesEssay) && (
          <div className="px-10 pb-8" style={{ order: getPreviewSectionOrder('values') }}>
            <div className="bg-white rounded-xl p-6 border border-[#e8e4dc]">
              <h3 className="font-bold text-lg text-[#2d2a26] mb-4">📝 나를 들려주는 이야기</h3>
              {richValueHasContent(p.valuesEssayBlocks)
                ? <RichTextPreview value={p.valuesEssayBlocks} />
                : <div className="prose prose-sm max-w-none text-[#5a564e] leading-[1.9] whitespace-pre-line">{p.valuesEssay}</div>}
            </div>
          </div>
        )}

        </div>

        {/* Interests */}
        {(p.interests || []).length > 0 && (
          <div className="px-10 pb-8">
            <h3 className="font-bold text-lg text-[#2d2a26] mb-4">🌿 관심사</h3>
            <div className="flex flex-wrap gap-2">
              {p.interests.map((interest, i) => (
                <VHtml key={i} className="px-4 py-2 bg-white rounded-full text-sm text-[#5a564e] border border-[#e8e4dc]" value={interest} />
              ))}
            </div>
          </div>
        )}

        <CustomPortfolioBlocks blocks={p.customBlocks} variant="ashley" onOpenCard={setSelectedExp} />

        {/* Footer */}
        <div className="px-10 py-5 border-t border-[#e8e4dc] flex items-center justify-between text-xs text-[#8a8578]">
          <span>FitPoly Portfolio · {p.userName || ''}</span>
          <a href="#notion-portfolio" className="hover:text-[#5a564e]">맨 위로 ↑</a>
        </div>
      </div>
    </div>
  );
}

// 이미지 리사이즈 후 Storage 업로드 → URL 반환. (base64를 문서에 저장하면 Firestore 1MB 한도 초과)
function resizeToBase64Global(file, maxPx = 1200, quality = 0.8) {
  return uploadImageUrl(file, maxPx, quality);
}

// ── Experience Detail Modal (Notion Page Style) ──
function ExperienceDetailModal({
  exp,
  readOnly = false,
  onUpdate,
  onClose,
  resizeToBase64,
  jobAnalysis,
}) {
  return (
    <Suspense fallback={null}>
      <ProjectDetailModal
        exp={exp}
        readOnly={readOnly}
        onUpdate={onUpdate}
        onClose={onClose}
        resizeToBase64={resizeToBase64}
        jobAnalysis={jobAnalysis}
      />
    </Suspense>
  );
}

// ── Timeline Layout (시간순 대시보드) ──
function TimelineLayout({ p, setSelectedExp }) {
  const contact = p.contact || {};
  const skills = p.skills || {};
  const curr = p.curricular || {};
  const getPreviewSectionOrder = makePreviewSectionOrder('timeline', p.sectionOrder);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = now.getDate();
  const dayNames = ['일','월','화','수','목','금','토'];

  // 학기별 그룹핑
  const coursesBySemester = (curr.courses || []).reduce((acc, c) => {
    const sem = c.semester || '기타';
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(c);
    return acc;
  }, {});
  const semesterKeys = Object.keys(coursesBySemester).sort();

  const sortedExperiences = [...(p.experiences || [])].sort((a, b) => (b.period || '').localeCompare(a.period || ''));

  return (
    <div data-tour="portfolio-preview-surface" className="max-w-[900px] mx-auto" id="notion-portfolio">
      {/* Dark header with calendar */}
      <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-t-2xl px-8 pt-8 pb-6">
        <div className="flex items-center gap-4 mb-6">
          {p.profileImageUrl ? (
            <img src={p.profileImageUrl} alt="" className="w-16 h-16 rounded-full object-contain bg-surface-50 ring-4 ring-white/20" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-3xl ring-4 ring-white/20">👤</div>
          )}
          <div className="flex-1">
            <VHtml as="h1" className="text-2xl font-bold text-white" value={p.headline || p.userName || '대시보드'} />
            {p.education?.length > 0 && (
              <p className="text-blue-200/70 text-xs mt-0.5"><VHtml value={p.education[0].name} /> · <VHtml value={p.education[0].degree} /></p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {contact.github && <a href={contact.github} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-white/10 rounded-lg text-xs text-white/70 hover:bg-white/20 transition-colors">GitHub</a>}
            {contact.website && <a href={contact.website} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-white/10 rounded-lg text-xs text-white/70 hover:bg-white/20 transition-colors">Web</a>}
            {contact.instagram && <a href={contact.instagram} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-white/10 rounded-lg text-xs text-white/70 hover:bg-white/20 transition-colors">Instagram</a>}
          </div>
        </div>
        {/* Calendar */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <p className="text-sm text-white/50 mb-3 text-center font-medium">{year}년 {month+1}월</p>
          <div className="grid grid-cols-7 gap-1 text-center">
            {dayNames.map(d => <div key={d} className="text-xs text-white/30 font-medium pb-1">{d}</div>)}
            {Array.from({ length: firstDay }, (_, i) => <div key={'e'+i} />)}
            {Array.from({ length: daysInMonth }, (_, i) => (
              <div key={i} className={`text-xs py-1.5 rounded-lg ${i+1 === today ? 'bg-purple-500 text-white font-bold' : 'text-white/40'}`}>{i+1}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-b-2xl border border-t-0 border-surface-200 shadow-sm">
        {/* Quick nav */}
        <div className="px-8 py-4 border-b border-surface-100 flex gap-3 overflow-x-auto">
          {['학기별 수업', '활동 기록', '스터디 계획', '기술', '수상'].map(menu => (
            <a key={menu} href={`#section-${menu}`} className="px-4 py-2 bg-surface-50 hover:bg-surface-100 rounded-lg text-sm text-gray-600 font-medium whitespace-nowrap transition-colors">{menu}</a>
          ))}
        </div>

        {/* 학기별 수업 */}
        {(curr.courses || []).length > 0 && (
          <div className="px-8 py-6 border-b border-surface-100" id="section-학기별 수업">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-purple-500 rounded-full" /> 학기별 수업
            </h2>
            <div className="space-y-4">
              {semesterKeys.map(sem => (
                <div key={sem} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-sm font-bold text-gray-700 mb-2">{sem}</p>
                  <div className="flex flex-wrap gap-2">
                    {coursesBySemester[sem].map((c, i) => (
                      <span key={i} className="px-3 py-1.5 bg-white rounded-lg text-sm text-gray-600 border border-gray-200">
                        {c.name}{c.grade ? ` (${c.grade})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col">

        {/* 활동 기록 */}
        {sortedExperiences.length > 0 && (
          <div className="px-8 py-6 border-b border-surface-100" id="section-활동 기록" style={{ order: getPreviewSectionOrder('activities') }}>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full" /> 활동 기록
            </h2>
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {sortedExperiences.map((exp, i) => {
                  const sr = exp.structuredResult || {};
                  const overview = sr.projectOverview || {};
                  const cardSummary = '';
                  const cardRole = '';
                  return (
                    <div key={i} className="flex items-start gap-3 relative cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                      onClick={() => setSelectedExp(exp)}>
                      <div className={`w-4 h-4 rounded-full flex-shrink-0 mt-1 z-10 border-2 border-white ${
                        exp.category === 'award' ? 'bg-amber-400' : exp.category === 'study' ? 'bg-purple-400' : 'bg-blue-400'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{exp.title || '(제목 없음)'}</p>
                        <p className="text-xs text-gray-400">{exp.period || exp.date || ''} {cardRole ? `· ${cardRole}` : ''}</p>
                        {cardSummary && <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{cardSummary}</p>}
                      </div>
                      {exp.framework && <span className="px-2 py-0.5 rounded text-[12px] bg-gray-100 text-gray-500 flex-shrink-0">{exp.framework}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 스터디 계획 */}
        {(p.goals || []).length > 0 && (
          <div className="px-8 py-6 border-b border-surface-100" id="section-스터디 계획" style={{ order: getPreviewSectionOrder('goals') }}>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-emerald-500 rounded-full" /> 스터디 계획
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {p.goals.map((g, i) => (
                <div key={i} className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-sm font-bold text-emerald-800 mb-1">{g.title}</p>
                  {richValueHasContent(g.descriptionBlocks)
                    ? <RichTextPreview value={g.descriptionBlocks} />
                    : <p className="text-xs text-emerald-600">{g.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 기술 */}
        <div className="px-8 py-6 border-b border-surface-100" id="section-기술" style={{ order: getPreviewSectionOrder('skills') }}>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-teal-500 rounded-full" /> 기술
          </h2>
          <div className="flex flex-wrap gap-2">
            {[...(skills.tools || []), ...(skills.languages || []), ...(skills.frameworks || []), ...(skills.others || [])].map((s, i) => (
              <span key={i} className="px-3 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200">
                {typeof s === 'string' ? s : s.name || s}
              </span>
            ))}
          </div>
        </div>

        </div>

        {/* 수상 */}
        {(p.awards || []).length > 0 && (
          <div className="px-8 py-6 border-b border-surface-100" id="section-수상">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-amber-500 rounded-full" /> 수상/장학금
            </h2>
            <div className="space-y-2">
              {p.awards.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.name}</p>
                    <p className="text-xs text-gray-400">{a.org} · {a.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <CustomPortfolioBlocks blocks={p.customBlocks} variant="timeline" onOpenCard={setSelectedExp} />

        {/* Footer */}
        <div className="px-8 py-4 bg-surface-50 flex items-center justify-between text-xs text-gray-400 rounded-b-2xl">
          <span>FitPoly Dashboard · {p.userName || ''}</span>
          <a href="#notion-portfolio" className="flex items-center gap-1 hover:text-gray-600">맨 위로 <ChevronUp size={12} /></a>
        </div>
      </div>
    </div>
  );
}
