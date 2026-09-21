/**
 * ServiceOnePager — /pic. 한 장짜리 서비스 소개 "이미지"를 그대로 보여주고 내려받는 화면.
 *
 * - 원본 이미지: public/pic/fitpoly-intro.png (4620×3322, 가로형 1.39:1 · Pretendard 내장)
 * - 문구를 고칠 때는 public/pic/fitpoly-intro.html 을 수정한 뒤 다시 PNG로 렌더해 교체한다.
 * - 같은 출처의 파일이라 download 속성만으로 내려받기가 동작한다(별도 서버 설정 불필요).
 */
import { useEffect } from 'react';
import { Download } from 'lucide-react';
import './ServiceOnePager.css';

const IMAGE = '/pic/fitpoly-intro.png';
const FILE_NAME = 'FitPoly-서비스소개.png';

export default function ServiceOnePager() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'FitPoly 서비스 소개';
    return () => { document.title = previous; };
  }, []);

  return (
    <main className="pic-page">
      <div className="pic-bar">
        <span className="pic-bar-title">FitPoly 서비스 소개</span>
        <a href={IMAGE} download={FILE_NAME} className="pic-bar-download">
          <Download size={16} aria-hidden="true" />이미지 다운로드
        </a>
      </div>
      <img
        className="pic-image"
        src={IMAGE}
        alt="FitPoly 서비스 소개 — 흩어진 기록을 합격하는 포트폴리오로. 문제 정의, 사용자 인터뷰, 해결 방법, 산출물, 차별점, 검증 6단계와 직군별 경험정리 결과·완성 포트폴리오 실제 화면"
        width="1500"
        height="1079"
      />
    </main>
  );
}
