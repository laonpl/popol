import { useNavigate } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import FileCat from './FileCat';
import { buildPortfolioReadiness } from '../utils/experienceReadiness';

export default function ExperiencePortfolioGuide({ experiences = [], onAdd }) {
  const navigate = useNavigate();
  const { readyCount, draftCount } = buildPortfolioReadiness(experiences);
  const canBuild = readyCount >= 3;
  const remaining = Math.max(0, 3 - readyCount);

  return (
    <aside className="fp-experience-guide" aria-label="다음 단계 안내">
      <span className="fp-guide-kicker">FITPOLY / NEXT STEP</span>
      <button type="button" className="fp-guide-cat-wrap" onClick={canBuild ? () => navigate('/app/portfolio/plan') : onAdd} aria-label={canBuild ? '포트폴리오 만들기 화면으로 이동' : '새 경험 만들기 화면으로 이동'}>
        <FileCat variant={canBuild ? 'happy' : 'thinking'} file="portfolio" withDocuments className="fp-guide-cat" />
      </button>
      <div className="fp-guide-message">
        <span className="fp-guide-step">{canBuild ? '준비 완료!' : '차근차근 모아봐요'}</span>
        <h2>{canBuild ? '충분한 경험이 쌓였어요. 이제 포트폴리오를 만들어봐요!' : `완성된 경험 ${remaining}개만 더 모으면 돼요!`}</h2>
        <p>{canBuild
          ? `바로 쓸 수 있는 경험 ${readyCount}개를 포트폴리오에 담아보세요.`
          : draftCount > 0
            ? `정리 중인 경험 ${draftCount}개가 있어요. 내용을 다듬고 완성해보세요.`
            : '작은 프로젝트나 활동도 좋아요. 하나씩 기록해보세요.'}</p>
      </div>
      <div className="fp-guide-progress" aria-label={`포트폴리오에 쓸 수 있는 경험 ${Math.min(readyCount, 3)}개 / 3개`}>
        {[0, 1, 2].map(index => <span key={index} className={index < readyCount ? 'is-ready' : ''} />)}
      </div>
      {canBuild ? (
        <button type="button" className="fp-guide-action" onClick={() => navigate('/app/portfolio/plan')}>
          포트폴리오 만들기 <FileText size={18} strokeWidth={2.4} />
        </button>
      ) : (
        <button type="button" className="fp-guide-action" onClick={onAdd}>
          경험 하나 더 만들기 <Plus size={18} strokeWidth={2.8} />
        </button>
      )}
    </aside>
  );
}
