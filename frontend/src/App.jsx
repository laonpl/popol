import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';

// ── 초기 로드 필수 (로그인 전 접근 가능) ──────────────────────────
import Landing from './pages/Landing';
import Login from './pages/Login';

// ── 코드 스플리팅: 인증 후에만 필요한 페이지 ─────────────────────
const ProfileSetup          = lazy(() => import('./pages/ProfileSetup'));
const ExperienceHub         = lazy(() => import('./pages/experience/ExperienceHub'));
const TemplateSelect        = lazy(() => import('./pages/experience/TemplateSelect'));
const ExperienceEditor      = lazy(() => import('./pages/experience/ExperienceEditor'));
const AnalysisResult        = lazy(() => import('./pages/experience/AnalysisResult'));
const StructuredResult      = lazy(() => import('./pages/experience/StructuredResult'));
const PortfolioHub          = lazy(() => import('./pages/portfolio/PortfolioHub'));
const PortfolioTemplateSelect = lazy(() => import('./pages/portfolio/PortfolioTemplateSelect'));
const NotionPortfolioEditor = lazy(() => import('./pages/portfolio/NotionPortfolioEditor'));
const NotionPortfolioPreview = lazy(() => import('./pages/portfolio/NotionPortfolioPreview'));
const PdfPortfolioExport    = lazy(() => import('./pages/portfolio/PdfPortfolioExport'));
const PublicPortfolioView   = lazy(() => import('./pages/portfolio/PublicPortfolioView'));

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
  if (!user.emailVerified) return <Navigate to="/login" replace />;
  return children;
}

function ProfileGuard({ children }) {
  const { profile, profileLoading } = useAuthStore();
  if (profileLoading) return <PageLoader />;
  if (!profile) return <Navigate to="/app/profile-setup" replace />;
  return children;
}

export default function App() {
  const init = useAuthStore(s => s.init);

  // onAuthStateChanged 구독 해제 — 언마운트 시 메모리 누수 방지
  useEffect(() => {
    const unsubscribe = init();
    return () => unsubscribe?.();
  }, [init]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/p/:id" element={<PublicPortfolioView />} />
        <Route path="/app/profile-setup" element={<PrivateRoute><ProfileSetup /></PrivateRoute>} />
        <Route path="/app" element={<PrivateRoute><ProfileGuard><Layout /></ProfileGuard></PrivateRoute>}>
          <Route index element={<Navigate to="/app/experience" replace />} />
          {/* 경험정리 */}
          <Route path="experience" element={<ExperienceHub />} />
          <Route path="experience/new" element={<TemplateSelect />} />
          <Route path="experience/edit/:id" element={<ExperienceEditor />} />
          <Route path="experience/edit/new/:framework" element={<ExperienceEditor />} />
          <Route path="experience/analysis/:id" element={<AnalysisResult />} />
          <Route path="experience/structured/:id" element={<StructuredResult />} />
          {/* 포트폴리오 */}
          <Route path="portfolio" element={<PortfolioHub />} />
          <Route path="portfolio/new" element={<PortfolioTemplateSelect />} />
          <Route path="portfolio/edit/:id" element={<NotionPortfolioEditor />} />
          <Route path="portfolio/edit-notion/:id" element={<NotionPortfolioEditor />} />
          <Route path="portfolio/preview/:id" element={<NotionPortfolioPreview />} />
          <Route path="portfolio/pdf/:id" element={<PdfPortfolioExport />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
