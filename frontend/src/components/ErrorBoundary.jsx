import { Component } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { reportClientError } from '../services/errorReporter';

/**
 * 렌더 중 오류가 나도 백지 화면이 되지 않도록 막는다.
 *
 * 예전엔 ErrorBoundary가 없어서 5,000줄짜리 화면에서 오류 하나가 나면
 * 화면 전체가 빈 흰 페이지가 되고 사용자는 복구할 방법이 없었다.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // 관리자 오류 로그로 보고 (본문 데이터는 보내지 않는다)
    try {
      reportClientError({
        message: `Render error: ${error?.message || error}`,
        source: 'react',
        stack: info?.componentStack?.slice(0, 2000),
      });
    } catch {
      /* 보고 실패가 화면을 또 깨뜨리지 않게 무시 */
    }
    console.error('[ErrorBoundary]', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
          <AlertTriangle size={26} className="text-amber-500" />
        </div>

        <h2 className="text-[20px] font-extrabold text-bluewood-900">
          화면을 표시하는 중 문제가 생겼어요
        </h2>
        <p className="mt-2 max-w-md text-[14px] leading-6 text-bluewood-500">
          작성하신 내용은 저장되어 있습니다. 아래 버튼으로 다시 시도해보시고,
          계속 같은 문제가 나타나면 알려주세요.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-primary-700"
          >
            <RotateCcw size={15} /> 다시 시도
          </button>
          <a
            href="/app"
            className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-5 py-2.5 text-[14px] font-bold text-bluewood-600 transition-colors hover:bg-surface-50"
          >
            <Home size={15} /> 홈으로
          </a>
          <a
            href="mailto:fitpoly.kr@gmail.com?subject=%5BFitPoly%5D%20%ED%99%94%EB%A9%B4%20%EC%98%A4%EB%A5%98%20%EC%A0%9C%EB%B3%B4"
            className="inline-flex items-center gap-2 px-3 py-2.5 text-[13px] font-semibold text-bluewood-400 underline underline-offset-2 transition-colors hover:text-bluewood-700"
          >
            문제 알리기
          </a>
        </div>

        {import.meta.env.DEV && this.state.error && (
          <pre className="custom-scrollbar mt-8 max-h-52 max-w-2xl overflow-auto rounded-xl border border-surface-200 bg-surface-50 p-4 text-left text-[12px] leading-relaxed text-bluewood-600">
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        )}
      </div>
    );
  }
}
