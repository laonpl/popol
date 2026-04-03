import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, MoreHorizontal, Trash2, Edit, Upload, LayoutTemplate, Download, Eye } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import ImportModal from '../../components/ImportModal';
import DetailModal from '../../components/DetailModal';
import ExportModal from '../../components/ExportModal';

export default function PortfolioHub() {
  const { user } = useAuthStore();
  const { portfolios, fetchPortfolios, createPortfolio, deletePortfolio, loading } = usePortfolioStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [exportData, setExportData] = useState(null);

  useEffect(() => {
    if (user?.uid) fetchPortfolios(user.uid);
  }, [user?.uid]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const id = await createPortfolio(user.uid, {
        title: '새 포트폴리오',
        userName: user.displayName || '',
      });
      navigate(`/app/portfolio/edit/${id}`);
    } catch (error) {
      console.error(error);
    }
    setCreating(false);
  };

  const handleImport = async ({ imported, structured }) => {
    try {
      const data = structured || {};
      const id = await createPortfolio(user.uid, {
        title: data.title || imported?.title || '임포트된 포트폴리오',
        userName: user.displayName || '',
        sections: data.sections || [],
      });
      navigate(`/app/portfolio/edit/${id}`);
    } catch (error) {
      console.error('임포트 적용 실패:', error);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">포트폴리오</h1>
          <p className="text-gray-500 mt-1">경험 DB 기반으로 맞춤형 포트폴리오를 작성하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-surface-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-surface-50 transition-colors"
          >
            <Upload size={16} />
            불러오기
          </button>
          <Link
            to="/app/portfolio/new"
            className="flex items-center gap-2 px-4 py-2.5 border border-primary-200 text-primary-600 rounded-xl text-sm font-medium hover:bg-primary-50 transition-colors"
          >
            <LayoutTemplate size={16} />
            템플릿으로 생성
          </Link>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Plus size={18} />
            새 포트폴리오
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : portfolios.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={40} className="text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-2">아직 포트폴리오가 없습니다</h3>
          <p className="text-gray-400 text-sm mb-6">경험을 먼저 정리한 후 포트폴리오를 작성해보세요</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus size={18} /> 첫 포트폴리오 만들기
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {portfolios.map(p => (
            <PortfolioCard
              key={p.id}
              portfolio={p}
              onDetail={() => setDetailData(p)}
              onExport={() => setExportData(p)}
              onDelete={() => {
                if (confirm('이 포트폴리오를 삭제하시겠습니까?')) deletePortfolio(p.id);
              }}
            />
          ))}
        </div>
      )}

      {showImport && (
        <ImportModal
          targetType="portfolio"
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}

      {detailData && (
        <DetailModal type="portfolio" data={detailData} onClose={() => setDetailData(null)} />
      )}

      {exportData && (
        <ExportModal type="portfolio" data={exportData} onClose={() => setExportData(null)} />
      )}
    </div>
  );
}

function PortfolioCard({ portfolio, onDelete, onDetail, onExport }) {
  const { id, title, targetCompany, targetPosition, status, exportFormat, createdAt } = portfolio;
  const date = createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '';
  const statusMap = {
    draft: { label: '작성 중', color: 'bg-yellow-50 text-yellow-700' },
    review: { label: '검토 중', color: 'bg-blue-50 text-blue-700' },
    exported: { label: '완료', color: 'bg-green-50 text-green-700' },
  };
  const s = statusMap[status] || statusMap.draft;

  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-3">
        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${s.color}`}>{s.label}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">{date}</span>
        </div>
      </div>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      {targetCompany && (
        <p className="text-sm text-gray-500">{targetCompany} · {targetPosition}</p>
      )}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-100">
        <button
          onClick={onDetail}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"
        >
          <Eye size={14} /> 자세히보기
        </button>
        <Link
          to={`/app/portfolio/edit/${id}`}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <Edit size={14} /> 편집
        </Link>
        <button
          onClick={onExport}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"
        >
          <Download size={14} /> 내보내기
        </button>
        <button
          onClick={onDelete}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 size={14} /> 삭제
        </button>
      </div>
    </div>
  );
}
