/**
 * LandingOutputPreview — 랜딩 산출물 쇼케이스용 실제 렌더러 래퍼.
 *
 * 목업이 아니다. 사용자가 실제로 받는 화면과 똑같은 렌더러
 * (WebPortfolioRenderer / VisualPortfolioRenderer)를 샘플 데이터로 그대로 호출한다.
 * 렌더러 묶음이 무거워 Landing 에서 lazy 로 불러오기 위해 별도 파일로 분리했다.
 */
import WebPortfolioRenderer, { WEB_SAMPLE_PORTFOLIO } from '../../pages/portfolio/WebPortfolioTemplates';
import VisualPortfolioRenderer from '../../pages/portfolio/VisualPortfolioTemplates';

export default function LandingOutputPreview({ templateId }) {
  const portfolio = { ...WEB_SAMPLE_PORTFOLIO, templateId };
  if (String(templateId).startsWith('web-')) {
    return <WebPortfolioRenderer portfolio={portfolio} embedded enableProjectModal={false} />;
  }
  return <VisualPortfolioRenderer portfolio={portfolio} />;
}
