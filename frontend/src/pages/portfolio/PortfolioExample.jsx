import { useEffect } from 'react';
import WebPortfolioRenderer from './WebPortfolioTemplates';
import { PORTFOLIO_EXAMPLES } from './portfolioExampleData';

const PAGE_TITLES = {
  example1: '김도윤 · 프론트엔드 개발자 포트폴리오',
  example2: '박서연 · 서비스 기획자 포트폴리오',
  example3: '이수민 · 마케터 포트폴리오',
};

export default function PortfolioExample({ exampleId }) {
  const portfolio = PORTFOLIO_EXAMPLES[exampleId] || PORTFOLIO_EXAMPLES.example1;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = PAGE_TITLES[exampleId] || PAGE_TITLES.example1;
    window.scrollTo(0, 0);
    return () => { document.title = previousTitle; };
  }, [exampleId]);

  return <WebPortfolioRenderer portfolio={portfolio} />;
}
