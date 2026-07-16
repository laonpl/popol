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
import { Loader2 } from 'lucide-react';

// ── 초기 로드 필수 (로그인 전 접근 가능) ──────────────────────────
import Landing from './pages/Landing';
import Login from './pages/Login';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

// ── 코드 스플리팅: 인증 후에만 필요한 페이지 ─────────────────────
const ProfileSetup          = lazy(() => import('./pages/ProfileSetup'));
const ExperienceHub         = lazy(() => import('./pages/experience/ExperienceHub'));
const TemplateSelect        = lazy(() => import('./pages/experience/TemplateSelect'));
const ExperienceInterview   = lazy(() => import('./pages/experience/ExperienceInterview'));
const ExperienceChat        = lazy(() => import('./pages/experience/ExperienceChat'));
const ExperienceResult      = lazy(() => import('./pages/experience/ExperienceResult'));
const ExperienceEditor      = lazy(() => import('./pages/experience/ExperienceEditor'));
const AnalysisResult        = lazy(() => import('./pages/experience/AnalysisResult'));
const StructuredResult      = lazy(() => import('./pages/experience/StructuredResult'));
const DeveloperPortfolio    = lazy(() => import('./pages/experience/DeveloperPortfolio'));
const PortfolioHub          = lazy(() => import('./pages/portfolio/PortfolioHub'));
const PortfolioTemplateSelect = lazy(() => import('./pages/portfolio/PortfolioTemplateSelect'));
const NotionPortfolioEditor = lazy(() => import('./pages/portfolio/NotionPortfolioEditor'));
const NotionPortfolioPreview = lazy(() => import('./pages/portfolio/NotionPortfolioPreview'));
const PublicPortfolioView   = lazy(() => import('./pages/portfolio/PublicPortfolioView'));
const AiPptExport           = lazy(() => import('./pages/portfolio/AiPptExport'));
const CreditSettings        = lazy(() => import('./pages/CreditSettings'));
const FeedbackAdmin         = lazy(() => import('./pages/FeedbackAdmin'));
const AdminCredits          = lazy(() => import('./pages/AdminCredits'));
const TemplateLab           = lazy(() => import('./pages/portfolio/TemplateLab')); // 웹사이트형 템플릿 검토용
const WebPortfolioEditor    = lazy(() => import('./pages/portfolio/WebPortfolioEditor'));
const WebPortfolioPreview   = lazy(() => import('./pages/portfolio/WebPortfolioPreview'));
const DeveloperPitchDemo    = lazy(() => import('./pages/DeveloperPitchDemo'));
const Demo                  = lazy(() => import('./pages/Demo'));

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

// 루트 레이아웃: 인증 구독 초기화 + Suspense. 데이터 라우터의 최상위 element.
function RootLayout() {
  const init = useAuthStore(s => s.init);

  // onAuthStateChanged 구독 해제 — 언마운트 시 메모리 누수 방지
  useEffect(() => {
    const unsubscribe = init();
    return () => unsubscribe?.();
  }, [init]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
}

// 데이터 라우터 — useBlocker(이탈 방지)가 동작하려면 createBrowserRouter가 필요하다.
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/eng" element={<DeveloperPitchDemo />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/p/:id" element={<PublicPortfolioView />} />
      <Route path="/tpl-lab/:tid" element={<TemplateLab />} /> {/* 웹사이트형 템플릿 검토용 */}
      <Route path="/feedback" element={<PrivateRoute><FeedbackAdmin /></PrivateRoute>} />
      <Route path="/admin" element={<AdminCredits />} />
      <Route path="/app/profile-setup" element={<PrivateRoute><ProfileSetup /></PrivateRoute>} />
      <Route path="/app" element={<PrivateRoute><ProfileGuard><Layout /></ProfileGuard></PrivateRoute>}>
        <Route index element={<Navigate to="/app/experience" replace />} />
        {/* 경험정리 */}
        <Route path="experience" element={<ExperienceHub />} />
        <Route path="experience/new" element={<TemplateSelect />} />
        <Route path="experience/interview" element={<ExperienceInterview />} />
        <Route path="experience/chat" element={<ExperienceChat />} />
        <Route path="experience/result/:id" element={<ExperienceResult />} />
        <Route path="experience/edit/:id" element={<ExperienceEditor />} />
        <Route path="experience/edit/new/:framework" element={<ExperienceEditor />} />
        <Route path="experience/analysis/:id" element={<AnalysisResult />} />
        <Route path="experience/structured/:id" element={<StructuredResult />} />
        <Route path="experience/dev-portfolio/:id" element={<DeveloperPortfolio />} />
        {/* 포트폴리오 */}
        <Route path="portfolio" element={<PortfolioHub />} />
        <Route path="portfolio/new" element={<PortfolioTemplateSelect />} />
        <Route path="portfolio/edit/:id" element={<NotionPortfolioEditor />} />
        <Route path="portfolio/edit-notion/:id" element={<NotionPortfolioEditor />} />
        <Route path="portfolio/preview/:id" element={<NotionPortfolioPreview />} />
        <Route path="portfolio/web-edit/:id" element={<WebPortfolioEditor />} />
        <Route path="portfolio/web-preview/:id" element={<WebPortfolioPreview />} />
        <Route path="portfolio/ai-ppt/:id" element={<AiPptExport />} />
        <Route path="settings/credits" element={<CreditSettings />} />
      </Route>
    </Route>
  )
);

export default function App() {
  return <RouterProvider router={router} />;
}
