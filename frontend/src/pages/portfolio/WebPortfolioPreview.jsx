/**
 * WebPortfolioPreview — 웹사이트형 템플릿 미리보기.
 * 공개 링크(/p/:id)와 100% 동일한 렌더러(WebPortfolioRenderer, 뷰 모드)를 사용한다.
 * 하단 플로팅 바에서 공개 발행(내보내기)·링크 복사·잠금 해제를 처리한다.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, Link2, Unlock, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import usePortfolioStore from '../../stores/portfolioStore';
import WebPortfolioRenderer from './WebPortfolioTemplates';

export default function WebPortfolioPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updatePortfolio } = usePortfolioStore();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/portfolio/${id}`);
        setPortfolio({ id, ...data });
      } catch {
        toast.error('포트폴리오를 불러오지 못했습니다');
      }
      setLoading(false);
    })();
  }, [id]);

  const publicUrl = `${window.location.origin}/p/${portfolio?.customSlug || id}`;
  const published = !!portfolio?.webLocked;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success('공개 링크가 복사되었습니다');
    } catch {
      toast.error('복사에 실패했습니다');
    }
  };

  const publish = async () => {
    setWorking(true);
    try {
      await updatePortfolio(id, { isPublic: true, webLocked: true, status: 'exported' });
      setPortfolio(prev => prev ? { ...prev, isPublic: true, webLocked: true } : prev);
      toast.success('공개 링크가 발행되었습니다. 편집이 잠깁니다.');
      copyLink();
    } catch {
      toast.error('발행에 실패했습니다');
    }
    setWorking(false);
  };

  const unlock = async () => {
    setWorking(true);
    try {
      await updatePortfolio(id, { isPublic: false, webLocked: false, status: 'draft' });
      setPortfolio(prev => prev ? { ...prev, isPublic: false, webLocked: false } : prev);
      toast.success('잠금이 해제되었습니다. 공개 링크는 비활성화됩니다.');
    } catch {
      toast.error('잠금 해제에 실패했습니다');
    }
    setWorking(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 size={30} className="animate-spin text-primary-600" /></div>;
  }
  if (!portfolio) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">포트폴리오를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="relative">
      {/* 공개 링크와 동일한 화면 */}
      <WebPortfolioRenderer portfolio={portfolio} embedded />

      {/* 플로팅 컨트롤 바 */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-1.5 rounded-full bg-neutral-900/90 backdrop-blur border border-white/15 px-2 py-1.5 shadow-2xl">
        <button type="button" onClick={() => navigate(`/app/portfolio/web-edit/${id}`)}
          className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold text-white/75 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={14} /> 편집으로
        </button>
        <span className="w-px h-4 bg-white/15" />
        {published ? (
          <>
            <button type="button" onClick={copyLink}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold text-white/90 hover:bg-white/10 transition-colors">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Link2 size={14} />} 링크 복사
            </button>
            <button type="button" onClick={unlock} disabled={working}
              className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-amber-600 transition-colors disabled:opacity-60">
              {working ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />} 잠금 해제
            </button>
          </>
        ) : (
          <button type="button" onClick={publish} disabled={working}
            className="flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-primary-500 transition-colors disabled:opacity-60">
            {working ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 내보내기 · 공개 발행
          </button>
        )}
      </div>
    </div>
  );
}
