import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <main className="min-h-screen bg-white text-bluewood-800">
      <div className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700">
          FitPoly 홈으로
        </Link>
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-gray-950">이용약관</h1>
        <p className="mt-3 text-sm text-bluewood-500">시행일: 2026년 5월 12일</p>

        <section className="mt-10 space-y-7 text-[15px] leading-7 text-bluewood-600">
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">1. 목적</h2>
            <p>본 약관은 FitPoly가 제공하는 포트폴리오 작성, 경험 정리, AI 분석 및 관련 서비스의 이용 조건과 절차, 이용자와 운영자의 권리 및 의무를 정합니다.</p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">2. 계정 및 이용</h2>
            <p>이용자는 본인의 정확한 정보를 바탕으로 계정을 생성해야 하며, 계정 접근 권한과 비밀번호를 안전하게 관리할 책임이 있습니다. 타인의 계정을 무단으로 사용하거나 서비스를 부정한 목적으로 이용할 수 없습니다.</p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">3. 콘텐츠와 권리</h2>
            <p>이용자가 입력하거나 업로드한 경험, 포트폴리오, 파일 등의 권리는 원칙적으로 이용자에게 있습니다. FitPoly는 서비스 제공, 저장, 분석, 내보내기 등 이용자가 요청한 기능 수행을 위해 필요한 범위에서만 해당 콘텐츠를 처리합니다.</p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">4. AI 기능</h2>
            <p>AI 분석 결과는 작성 보조를 위한 참고 자료이며, 최종 제출 전 정확성, 적합성, 권리 침해 여부는 이용자가 직접 검토해야 합니다.</p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">5. 서비스 변경 및 중단</h2>
            <p>운영상 또는 기술상 필요한 경우 서비스의 일부 기능이 변경되거나 일시 중단될 수 있습니다. 중요한 변경 사항은 서비스 화면 또는 이메일 등 적절한 방법으로 안내합니다.</p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">6. 문의</h2>
            <p>약관 관련 문의는 <a className="text-primary-600 underline font-semibold" href="mailto:gudrbs14@naver.com">gudrbs14@naver.com</a>으로 연락해주세요.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
