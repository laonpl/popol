import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { Compass, Home, ArrowLeft } from 'lucide-react';
import useAuthStore from '../stores/authStore';

/**
 * 없는 주소로 들어왔을 때 보여주는 화면.
 * 라우터의 errorElement로도 쓰이므로, 404가 아닌 라우팅 오류도 함께 받아낸다.
 * (예전엔 catch-all 라우트가 없어 react-router 기본 오류 화면이 그대로 노출됐다)
 */
export default function NotFound() {
  const error = useRouteError();
  const { user } = useAuthStore();

  const isNotFound = !error || (isRouteErrorResponse(error) && error.status === 404);
  const homePath = user ? '/app' : '/';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-50/60 px-6 py-20 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
        <Compass size={30} className="text-primary-500" />
      </div>

      <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-primary-400">
        {isNotFound ? 'Page not found' : 'Something went wrong'}
      </p>
      <h1 className="mt-2 text-[26px] font-extrabold tracking-tight text-bluewood-900">
        {isNotFound ? '페이지를 찾을 수 없어요' : '페이지를 여는 중 문제가 생겼어요'}
      </h1>
      <p className="mt-3 max-w-md text-[14px] leading-6 text-bluewood-500">
        {isNotFound
          ? '주소가 바뀌었거나 삭제된 페이지일 수 있어요. 아래에서 원하는 곳으로 이동해보세요.'
          : '잠시 후 다시 시도해주세요. 계속 같은 문제가 나타나면 알려주세요.'}
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        <Link
          to={homePath}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-primary-700"
        >
          <Home size={15} /> {user ? '내 작업으로' : '홈으로'}
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-5 py-2.5 text-[14px] font-bold text-bluewood-600 transition-colors hover:bg-surface-50"
        >
          <ArrowLeft size={15} /> 이전 페이지
        </button>
      </div>

      {user && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-semibold text-bluewood-400">
          <Link to="/app/experience" className="transition-colors hover:text-primary-600">경험 정리</Link>
          <Link to="/app/portfolio" className="transition-colors hover:text-primary-600">포트폴리오</Link>
          <Link to="/app/settings/credits" className="transition-colors hover:text-primary-600">크레딧 관리</Link>
        </div>
      )}
    </main>
  );
}
