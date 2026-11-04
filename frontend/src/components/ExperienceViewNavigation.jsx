import { Link } from 'react-router-dom';
import './experience-view.css';

export default function ExperienceViewNavigation({
  id,
  active,
  jobCategory,
  onLinkClick,
  tutorial = false,
  backTo = '/app/experience',
}) {
  const backLabel = tutorial ? '튜토리얼로 돌아가기' : '경험 목록';
  const views = [
    { key: 'core', label: jobCategory === 'common' ? '케이스 스터디' : '핵심 경험', to: `/app/experience/result/${id}` },
    { key: 'detail', label: '전체 내용', to: `/app/experience/structured/${id}` },
  ];

  return (
    <div className="fp-result-navigation">
      <Link to={backTo} onClick={onLinkClick} className="fp-result-back" aria-label={backLabel}>
        ← <span className="hidden sm:inline">{backLabel}</span>
      </Link>
      {!tutorial && (
        <nav className="fp-result-views" aria-label="경험 보기 방식">
          {views.map(view => active === view.key
            ? <span key={view.key} aria-current="page">{view.label}</span>
            : <Link key={view.key} to={view.to} onClick={onLinkClick}>{view.label}</Link>)}
        </nav>
      )}
    </div>
  );
}
