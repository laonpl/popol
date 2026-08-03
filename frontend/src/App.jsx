import { useEffect, lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
  Navigate,
  Outlet,
} from 'react-router-dom';
import useAuthStore from './stores/authStore';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// ── 초기 로드 필수 (로그인 전 접근 가능) ──────────────────────────
import Landing from './pages/Landing';
import Login from './pages/Login';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import NotFound from './pages/NotFound';

// ── 코드 스플리팅: 인증 후에만 필요한 페이지 ─────────────────────
const ProfileSetup          = lazy(() => import('./pages/ProfileSetup'));
const ExperienceHub         = lazy(() => import('./pages/experience/ExperienceHub'));
const TemplateSelect        = lazy(() => import('./pages/experience/TemplateSelect'));
const ExperienceInterview   = lazy(() => import('./pages/experience/ExperienceInterview'));
const ExperienceChat        = lazy(() => import('./pages/experience/ExperienceChat'));
const ExperienceResult      = lazy(() => import('./pages/experience/ExperienceResult'));
const ExperienceCompletion  = lazy(() => import('./pages/experience/ExperienceCompletion'));
const QuickExperienceCapture = lazy(() => import('./pages/experience/QuickExperienceCapture'));
const ExperienceCandidateInbox = lazy(() => import('./pages/experience/ExperienceCandidateInbox'));
const ExperienceEditor      = lazy(() => import('./pages/experience/ExperienceEditor'));
const AnalysisResult        = lazy(() => import('./pages/experience/AnalysisResult'));
const StructuredResult      = lazy(() => import('./pages/experience/StructuredResult'));
const DeveloperPortfolio    = lazy(() => import('./pages/experience/DeveloperPortfolio'));
const PortfolioHub          = lazy(() => import('./pages/portfolio/PortfolioHub'));
const PortfolioPlanBuilder  = lazy(() => import('./pages/portfolio/PortfolioPlanBuilder'));
const PortfolioTemplateSelect = lazy(() => import('./pages/portfolio/PortfolioTemplateSelect'));
const NotionPortfolioEditor = lazy(() => import('./pages/portfolio/NotionPortfolioEditor'));
const NotionPortfolioPreview = lazy(() => import('./pages/portfolio/NotionPortfolioPreview'));
const PublicPortfolioView   = lazy(() => import('./pages/portfolio/PublicPortfolioView'));
const AiPptExport           = lazy(() => import('./pages/portfolio/AiPptExport'));
const CreditSettings        = lazy(() => import('./pages/CreditSettings'));
const FeedbackAdmin         = lazy(() => import('./pages/FeedbackAdmin'));
const AdminCredits          = lazy(() => import('./pages/AdminCredits'));
const TemplateLab           = lazy(() => import('./pages/portfolio/TemplateLab')); // 웹사이트형 템플릿 검토용
const SampleOutput          = lazy(() => import('./pages/SampleOutput')); // 개선된 산출물 예시 확인용
const WebPortfolioEditor    = lazy(() => import('./pages/portfolio/WebPortfolioEditor'));
const WebPortfolioPreview   = lazy(() => import('./pages/portfolio/WebPortfolioPreview'));
const PortfolioExample      = lazy(() => import('./pages/portfolio/PortfolioExample'));
const DeveloperPitchDemo    = lazy(() => import('./pages/DeveloperPitchDemo'));
const Demo                  = lazy(() => import('./pages/Demo'));
const ServiceDeck           = lazy(() => import('./pages/ServiceDeck')); // 슬라이드형 서비스 소개서 (/deck)
const Resultt               = lazy(() => import('./pages/Resultt')); // 직무별 경험정리 결과 예시

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary-600" />
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function ProfileGuard({ children }) {
  const { user, profile, profileLoading } = useAuthStore();
  if (profileLoading) return <PageLoader />;
  if (user && !profile) return <Navigate to="/app/profile-setup" replace />;
  return children;
}

// /app 공통 셸. 비로그인 방문자에게도 레이아웃을 렌더해 허브 화면을 볼 수 있게 하고,
// 로그인한 사용자에게만 기존 프로필 설정 가드를 적용한다.
function AppShell() {
  const { user, loading } = useAuthStore();
  if (loading) return <PageLoader />;
  if (!user) return <Layout />;
  return <ProfileGuard><Layout /></ProfileGuard>;
}

// 루트 레이아웃: 인증 구독 초기화 + Suspense. 데이터 라우터의 최상위 element.
function RootLayout() {
  const init = useAuthStore(s => s.init);

  // onAuthStateChanged 구독 해제 — 언마운트 시 메모리 누수 방지
  useEffect(() => {
    const unsubscribe = init();
    return () => unsubscribe?.();
  }, [init]);

  return (
    // ErrorBoundary: 화면 렌더 중 오류가 나도 백지가 되지 않도록 감싼다.
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );
}

// 데이터 라우터 — useBlocker(이탈 방지)가 동작하려면 createBrowserRouter가 필요하다.
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />} errorElement={<NotFound />}>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/eng" element={<DeveloperPitchDemo />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/deck" element={<ServiceDeck />} />
      <Route path="/sample" element={<SampleOutput />} />
      <Route path="/p/:id" element={<PublicPortfolioView />} />
      <Route path="/example1" element={<PortfolioExample exampleId="example1" />} />
      <Route path="/example2" element={<PortfolioExample exampleId="example2" />} />
      <Route path="/example3" element={<PortfolioExample exampleId="example3" />} />
      {/* 경험정리 결과 예시 — /resultt는 직무 탭, /example4~6은 직무별 전용 URL(각각 색인·공유용) */}
      <Route path="/resultt" element={<Resultt />} />
      <Route path="/example4" element={<Resultt roleId="dev" />} />
      <Route path="/example5" element={<Resultt roleId="marketer" />} />
      <Route path="/example6" element={<Resultt roleId="pm" />} />
      <Route path="/tpl-lab/:tid" element={<TemplateLab />} /> {/* 웹사이트형 템플릿 검토용 */}
      <Route path="/feedback" element={<PrivateRoute><FeedbackAdmin /></PrivateRoute>} />
      <Route path="/admin" element={<AdminCredits />} />
      <Route path="/app/profile-setup" element={<PrivateRoute><ProfileSetup /></PrivateRoute>} />
      {/* 허브 화면은 비로그인도 볼 수 있고(가입 전 제품 확인), 기능 실행 시점에만 로그인을 요구한다. */}
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="/app/experience" replace />} />
        {/* 경험정리 */}
        <Route path="experience" element={<ExperienceHub />} />
        <Route path="experience/new" element={<PrivateRoute><TemplateSelect /></PrivateRoute>} />
        <Route path="experience/interview" element={<PrivateRoute><ExperienceInterview /></PrivateRoute>} />
        <Route path="experience/chat" element={<PrivateRoute><ExperienceChat /></PrivateRoute>} />
        <Route path="experience/result/:id" element={<PrivateRoute><ExperienceResult /></PrivateRoute>} />
        <Route path="experience/complete/:id" element={<PrivateRoute><ExperienceCompletion /></PrivateRoute>} />
        <Route path="experience/quick" element={<PrivateRoute><QuickExperienceCapture /></PrivateRoute>} />
        <Route path="experience/candidates" element={<PrivateRoute><ExperienceCandidateInbox /></PrivateRoute>} />
        <Route path="experience/edit/:id" element={<PrivateRoute><ExperienceEditor /></PrivateRoute>} />
        <Route path="experience/edit/new/:framework" element={<PrivateRoute><ExperienceEditor /></PrivateRoute>} />
        <Route path="experience/analysis/:id" element={<PrivateRoute><AnalysisResult /></PrivateRoute>} />
        <Route path="experience/structured/:id" element={<PrivateRoute><StructuredResult /></PrivateRoute>} />
        <Route path="experience/dev-portfolio/:id" element={<PrivateRoute><DeveloperPortfolio /></PrivateRoute>} />
        {/* 포트폴리오 */}
        <Route path="portfolio" element={<PortfolioHub />} />
        <Route path="portfolio/plan" element={<PrivateRoute><PortfolioPlanBuilder /></PrivateRoute>} />
        <Route path="portfolio/new" element={<PrivateRoute><PortfolioTemplateSelect /></PrivateRoute>} />
        <Route path="portfolio/edit/:id" element={<PrivateRoute><NotionPortfolioEditor /></PrivateRoute>} />
        <Route path="portfolio/edit-notion/:id" element={<PrivateRoute><NotionPortfolioEditor /></PrivateRoute>} />
        <Route path="portfolio/preview/:id" element={<PrivateRoute><NotionPortfolioPreview /></PrivateRoute>} />
        <Route path="portfolio/web-edit/:id" element={<PrivateRoute><WebPortfolioEditor /></PrivateRoute>} />
        <Route path="portfolio/web-preview/:id" element={<PrivateRoute><WebPortfolioPreview /></PrivateRoute>} />
        <Route path="portfolio/ai-ppt/:id" element={<PrivateRoute><AiPptExport /></PrivateRoute>} />
        <Route path="settings/credits" element={<PrivateRoute><CreditSettings /></PrivateRoute>} />
        {/* /app 하위의 잘못된 주소 */}
        <Route path="*" element={<NotFound />} />
      </Route>
      {/* 그 외 모든 주소 */}
      <Route path="*" element={<NotFound />} />
    </Route>
  )
);

export default function App() {
  return <RouterProvider router={router} />;
}
