import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

const DEFAULT_MESSAGE = '저장하지 않은 변경사항이 있습니다.\n저장하지 않고 나가시겠습니까?';

/**
 * 편집 중 변경사항이 있을 때(when=true) 페이지 이탈을 막는다.
 * - 앱 내부 이동(링크/뒤로가기/navigate): 확인 팝업으로 차단
 * - 브라우저 탭 닫기/새로고침/주소 변경: 브라우저 기본 경고창
 *
 * 데이터 라우터(createBrowserRouter) 환경에서만 useBlocker가 동작한다.
 */
export default function useUnsavedChanges(when, message = DEFAULT_MESSAGE) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      Boolean(when) && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(message)) blocker.proceed();
    else blocker.reset();
  }, [blocker, message]);

  useEffect(() => {
    if (!when) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);
}
