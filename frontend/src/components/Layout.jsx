import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { useEffect, useRef, useState } from 'react';
import { Settings, X, Gift, Menu, LogOut, User, WalletCards } from 'lucide-react';
import useCreditStore from '../stores/creditStore';
import CreditDepletedModal from './CreditDepletedModal';
import FeedbackModal from './FeedbackModal';
import JourneyResumeBanner from './JourneyResumeBanner';

const navItems = [
  { to: '/app/experience', label: '경험 정리' },
  { to: '/app/portfolio', label: '포트폴리오' },
];

// 이 아래로 떨어지면 헤더 칩이 경고색으로 바뀐다 (작업 중 갑자기 막히는 상황 예방)
const LOW_CREDIT_THRESHOLD = 300;

export default function Layout() {
  const { user, profile, signOut } = useAuthStore();
  const { wallet, loadWallet, refreshWallet, clearWallet } = useCreditStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditPanelOpen, setCreditPanelOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rewardPromptDismissed, setRewardPromptDismissed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const settingsMenuRef = useRef(null);
  const creditAreaRef = useRef(null);

  const handleSignOut = async () => {
    await signOut();
    clearWallet();
    navigate('/');
  };

  const displayName = profile?.nameKo || user?.displayName || '사용자';
  const creditBalance = Math.max(0, Number(wallet?.balance || 0));
  const formattedCredits = creditBalance.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  const totalCharged = Math.max(0, Number(wallet?.totalCharged || 0));
  const totalUsed = Math.max(0, Number(wallet?.totalUsed || 0));
  // 크레딧을 다 쓰고 아직 피드백 보상을 못 받은 사용자에게만 유도 안내를 보여준다.
  const rewardEligible = creditBalance === 0 && !!wallet && !wallet.feedbackRewardGranted && !rewardPromptDismissed;
  const creditModalKey = user?.uid ? `fitpoly-credit-zero-modal:${user.uid}` : '';
  const isWebPortfolioSurface = /^\/app\/portfolio\/web-(?:edit|preview)\//.test(location.pathname);

  const showCreditModal = () => {
    if (!creditModalKey) return;
    if (window.sessionStorage.getItem(creditModalKey) === '1') return;
    window.sessionStorage.setItem(creditModalKey, '1');
    setCreditModalOpen(true);
  };

  useEffect(() => {
    loadWallet({ silent: true }).catch(() => {});
    window.addEventListener('credits:refresh', refreshWallet);
    window.addEventListener('credits:depleted', showCreditModal);
    return () => {
      window.removeEventListener('credits:refresh', refreshWallet);
      window.removeEventListener('credits:depleted', showCreditModal);
    };
  }, [loadWallet, refreshWallet, creditModalKey]);

  useEffect(() => {
    if (!wallet || !creditModalKey) return;
    if (creditBalance > 0) {
      window.sessionStorage.removeItem(creditModalKey);
      return;
    }
    showCreditModal();
  }, [wallet, creditBalance, creditModalKey]);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const closeOnOutside = (event) => {
      if (settingsMenuRef.current?.contains(event.target)) return;
      setSettingsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('mousedown', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('mousedown', closeOnOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!creditPanelOpen) return undefined;
    const closeOnOutside = (event) => {
      if (creditAreaRef.current?.contains(event.target)) return;
      setCreditPanelOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setCreditPanelOpen(false);
    };
    window.addEventListener('mousedown', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('mousedown', closeOnOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [creditPanelOpen]);

  const goSettings = (path) => {
    setSettingsOpen(false);
    setMobileMenuOpen(false);
    navigate(path);
  };

  // 화면 이동 시 모바일 메뉴는 닫는다
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  // 모바일 메뉴가 열린 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e) => { if (e.key === 'Escape') setMobileMenuOpen(false); };
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onEsc);
    };
  }, [mobileMenuOpen]);

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f5]">
      <CreditDepletedModal
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        onOpenFeedback={!wallet?.feedbackRewardGranted ? () => setFeedbackOpen(true) : undefined}
      />
      <FeedbackModal
        open={feedbackOpen}
        context="credit_depleted"
        onClose={(res) => {
          setFeedbackOpen(false);
          if (res?.submitted) {
            setRewardPromptDismissed(true);
            refreshWallet();
          }
        }}
      />
      {/* 상단 네비게이션 */}
      <header className="relative z-[80] flex-shrink-0 bg-white border-b border-surface-200">
        <div className="relative px-4 sm:px-6 flex items-center h-16 gap-2">
          {/* 로고 */}
          <button onClick={() => navigate('/app')} aria-label="FitPoly 홈" className="flex flex-shrink-0 items-center gap-2">
            <img src="/logo.png" alt="FitPoly" className="h-8 w-auto" />
          </button>

          {/* 메뉴 탭 — lg 이상에서만 절대 가운데 정렬.
              그 아래에서는 로고/유저 영역과 겹치므로 흐름 배치로 전환한다. */}
          <nav className="hidden md:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2 items-center bg-surface-100 rounded-full p-1 ml-2 lg:ml-0">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-4 lg:px-6 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'text-bluewood-500 hover:text-bluewood-800'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* 모바일: 햄버거 버튼 */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={mobileMenuOpen}
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-bluewood-500 transition-colors hover:bg-surface-50 hover:text-primary-600 md:hidden"
          >
            <Menu size={20} />
          </button>

          {/* 유저 (md 이상) */}
          <div className="ml-auto hidden md:flex items-center gap-2 lg:gap-3">
            <div className="relative" ref={creditAreaRef}>
              {/* 잔액이 적으면 색으로 미리 알린다 — 작업 도중 갑자기 막히는 상황을 줄인다 */}
              <button
                type="button"
                onClick={() => setCreditPanelOpen(open => !open)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                  creditBalance <= 0
                    ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                    : creditBalance < LOW_CREDIT_THRESHOLD
                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'border-primary-100 bg-primary-50 text-primary-700 hover:border-primary-200 hover:bg-primary-100'
                }`}
                title={creditBalance <= 0 ? '크레딧이 없습니다' : creditBalance < LOW_CREDIT_THRESHOLD ? '크레딧이 얼마 남지 않았어요' : '크레딧 현황'}
                aria-expanded={creditPanelOpen}
              >
                <span className={creditBalance < LOW_CREDIT_THRESHOLD ? 'opacity-70' : 'text-primary-400'}>C</span>
                <span className="tabular-nums">{formattedCredits}</span>
              </button>

              {/* 크레딧 버튼 클릭 시: 잔여·사용 현황을 먼저 보여주고 관리 페이지로 유도 (불필요한 이탈 방지) */}
              {creditPanelOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-surface-200 bg-white p-4 shadow-xl z-[90]">
                  <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary-500">크레딧 현황</p>
                  <p className="mt-1 flex items-end gap-1 text-bluewood-900">
                    <span className="text-2xl font-extrabold tabular-nums">{formattedCredits}</span>
                    <span className="mb-0.5 text-sm font-bold text-bluewood-300">C 남음</span>
                  </p>
                  {creditBalance > 0 && creditBalance < LOW_CREDIT_THRESHOLD && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[12px] font-medium leading-4 text-amber-700">
                      크레딧이 얼마 남지 않았어요. 긴 작업을 시작하기 전에 충전해두면 중간에 끊기지 않아요.
                    </p>
                  )}
                  <p className="mt-2 text-[12px] leading-4 text-bluewood-400">
                    AI가 실제로 처리한 분량만큼 차감돼요. 자료가 길수록 더 많이 사용됩니다.
                  </p>
                  <div className="mt-3 space-y-1.5 border-t border-surface-100 pt-3 text-[12.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-bluewood-400">누적 충전</span>
                      <span className="font-bold tabular-nums text-bluewood-700">{totalCharged.toLocaleString('ko-KR')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-bluewood-400">누적 사용</span>
                      <span className="font-bold tabular-nums text-bluewood-700">{totalUsed.toLocaleString('ko-KR')}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCreditPanelOpen(false); navigate('/app/settings/credits'); }}
                    className="mt-3.5 w-full rounded-lg bg-primary-600 px-3 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-primary-700"
                  >
                    크레딧 관리로 이동
                  </button>
                </div>
              )}

              {/* 크레딧 소진 시: 피드백 남기면 300 크레딧 유도 (보상 미수령자만) */}
              {rewardEligible && !creditPanelOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-primary-100 bg-white p-3 shadow-xl z-[60]">
                  <button
                    type="button"
                    onClick={() => setRewardPromptDismissed(true)}
                    className="absolute right-2 top-2 text-bluewood-300 transition-colors hover:text-bluewood-600"
                    aria-label="닫기"
                  >
                    <X size={14} />
                  </button>
                  <div className="flex items-center gap-1.5 text-primary-600">
                    <Gift size={15} />
                    <span className="text-[12px] font-extrabold">크레딧을 다 쓰셨나요?</span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-5 text-bluewood-500">
                    리뷰·피드백을 남겨주시면 <b className="text-primary-600">300 크레딧</b>을 바로 드려요!
                  </p>
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen(true)}
                    className="mt-2.5 w-full rounded-lg bg-primary-600 px-3 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-primary-700"
                  >
                    피드백 남기고 300C 받기
                  </button>
                </div>
              )}
            </div>
            <span className="hidden lg:inline text-sm font-medium text-bluewood-700 max-w-[140px] truncate">
              {displayName}
            </span>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full ring-2 ring-surface-200" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-bold ring-2 ring-surface-200">
                {displayName[0]}
              </div>
            )}
            <div ref={settingsMenuRef} className="relative">
              <button
                onClick={() => setSettingsOpen(open => !open)}
                className="p-1.5 text-bluewood-400 hover:text-primary-600 transition-colors"
                title="설정"
                aria-label="설정"
                aria-expanded={settingsOpen}
              >
                <Settings size={16} />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full z-[90] mt-2 w-44 overflow-hidden rounded-lg border border-surface-200 bg-white py-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => goSettings('/app/settings/credits')}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-bluewood-700 transition-colors hover:bg-surface-50 hover:text-primary-600"
                  >
                    크레딧 관리
                  </button>
                  <button
                    type="button"
                    onClick={() => goSettings('/app/profile-setup')}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-bluewood-700 transition-colors hover:bg-surface-50 hover:text-primary-600"
                  >
                    내 정보 관리
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="whitespace-nowrap text-xs text-bluewood-400 hover:text-red-500 transition-colors ml-1"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* ── 모바일 메뉴 (md 미만) ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[95] md:hidden">
          <div
            className="absolute inset-0 bg-bluewood-950/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="메뉴"
            className="absolute right-0 top-0 flex h-full w-[82%] max-w-[320px] flex-col bg-white shadow-2xl"
          >
            {/* 사용자 요약 */}
            <div className="flex items-center gap-3 border-b border-surface-100 px-5 py-4">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="h-11 w-11 rounded-full ring-2 ring-surface-200" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-[15px] font-bold text-primary-600 ring-2 ring-surface-200">
                  {displayName[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-bluewood-800">{displayName}</p>
                <p className="text-[12.5px] text-bluewood-400">잔여 {formattedCredits} C</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="메뉴 닫기"
                className="rounded-lg p-2 text-bluewood-400 transition-colors hover:bg-surface-50 hover:text-bluewood-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* 주요 이동 */}
            <nav className="flex flex-col gap-1 px-3 py-3">
              {navItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-3 text-[15px] font-bold transition-colors ${
                      isActive ? 'bg-primary-500 text-white' : 'text-bluewood-700 hover:bg-surface-50'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="mx-3 border-t border-surface-100" />

            <div className="flex flex-col gap-1 px-3 py-3">
              <button
                type="button"
                onClick={() => goSettings('/app/settings/credits')}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14.5px] font-semibold text-bluewood-700 transition-colors hover:bg-surface-50"
              >
                <WalletCards size={17} className="text-bluewood-400" /> 크레딧 관리
              </button>
              <button
                type="button"
                onClick={() => goSettings('/app/profile-setup')}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[14.5px] font-semibold text-bluewood-700 transition-colors hover:bg-surface-50"
              >
                <User size={17} className="text-bluewood-400" /> 내 정보 관리
              </button>
            </div>

            {/* 크레딧 소진 시 보상 안내 */}
            {rewardEligible && (
              <div className="mx-3 mb-2 rounded-xl border border-primary-100 bg-primary-50/60 p-3">
                <div className="flex items-center gap-1.5 text-primary-600">
                  <Gift size={15} />
                  <span className="text-[12.5px] font-extrabold">크레딧을 다 쓰셨나요?</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-5 text-bluewood-500">
                  리뷰·피드백을 남겨주시면 <b className="text-primary-600">300 크레딧</b>을 드려요.
                </p>
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); setFeedbackOpen(true); }}
                  className="mt-2 w-full rounded-lg bg-primary-600 px-3 py-2 text-[13px] font-bold text-white"
                >
                  피드백 남기고 300C 받기
                </button>
              </div>
            )}

            <button
              onClick={handleSignOut}
              className="mt-auto flex items-center gap-3 border-t border-surface-100 px-7 py-4 text-left text-[14px] font-semibold text-bluewood-400 transition-colors hover:text-red-500"
            >
              <LogOut size={16} /> 로그아웃
            </button>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto">
        <div className={`w-full ${isWebPortfolioSurface ? 'p-0' : 'p-4 sm:p-6 lg:p-8'}`}>
          {!isWebPortfolioSurface && <JourneyResumeBanner />}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
