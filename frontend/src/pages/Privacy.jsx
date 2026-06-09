import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <main className="min-h-screen bg-white text-bluewood-800">
      <div className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700">
          FitPoly 홈으로
        </Link>
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-gray-950">개인정보처리방침</h1>
        <p className="mt-3 text-sm text-bluewood-500">시행일: 2026년 5월 12일</p>

        <section className="mt-10 space-y-7 text-[15px] leading-7 text-bluewood-600">
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">1. 수집하는 개인정보</h2>
            <p>FitPoly는 회원가입 및 서비스 제공을 위해 이메일, 이름, 프로필 정보, 포트폴리오 작성 데이터, 업로드 파일, 서비스 이용 기록을 수집할 수 있습니다.</p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">2. 이용 목적</h2>
            <p>수집한 정보는 계정 관리, 본인 확인, 포트폴리오 작성 및 저장, AI 분석, 파일 내보내기, 고객 문의 대응, 서비스 안정성 개선을 위해 사용합니다.</p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">3. 보관 및 파기</h2>
            <p>개인정보는 서비스 이용 기간 동안 보관하며, 이용자가 계정 삭제를 요청하면 관련 법령상 보관이 필요한 경우를 제외하고 지체 없이 삭제합니다.</p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">4. 제3자 제공 및 처리 위탁</h2>
            <p>서비스 제공을 위해 Firebase, Render, Vercel, AI 분석 API 등 외부 인프라와 처리 시스템을 사용할 수 있습니다. FitPoly는 서비스 제공에 필요한 범위에서만 데이터를 처리합니다.</p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">5. 이용자의 권리</h2>
            <p>이용자는 본인의 개인정보 조회, 수정, 삭제, 처리 정지를 요청할 수 있습니다. 계정 및 데이터 삭제는 서비스 내 기능 또는 문의를 통해 요청할 수 있습니다.</p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">6. 문의</h2>
            <p>개인정보 관련 문의는 <a className="text-primary-600 underline font-semibold" href="mailto:fitpoly.kr@gmail.com">fitpoly.kr@gmail.com</a>으로 연락해주세요.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
