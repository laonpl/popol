import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import ExperienceHub from './pages/experience/ExperienceHub';
import TemplateSelect from './pages/experience/TemplateSelect';
import ExperienceEditor from './pages/experience/ExperienceEditor';
import AnalysisResult from './pages/experience/AnalysisResult';
import StructuredResult from './pages/experience/StructuredResult';
import PortfolioHub from './pages/portfolio/PortfolioHub';
import PortfolioEditor from './pages/portfolio/PortfolioEditor';
import PortfolioTemplateSelect from './pages/portfolio/PortfolioTemplateSelect';
import NotionPortfolioEditor from './pages/portfolio/NotionPortfolioEditor';
import NotionPortfolioPreview from './pages/portfolio/NotionPortfolioPreview';
import CoverLetterHub from './pages/coverletter/CoverLetterHub';
import CoverLetterEditor from './pages/coverletter/CoverLetterEditor';

// 로그인 없이 바로 접근 가능
function PrivateRoute({ children }) {
  return children;
}

export default function App() {
  const init = useAuthStore(s => s.init);
  useEffect(() => { init(); }, [init]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
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
        <Route path="portfolio/edit/:id" element={<PortfolioEditor />} />
        <Route path="portfolio/edit-notion/:id" element={<NotionPortfolioEditor />} />
        <Route path="portfolio/preview/:id" element={<NotionPortfolioPreview />} />
        {/* 자소서 */}
        <Route path="coverletter" element={<CoverLetterHub />} />
        <Route path="coverletter/edit/:id" element={<CoverLetterEditor />} />
      </Route>
    </Routes>
  );
}
