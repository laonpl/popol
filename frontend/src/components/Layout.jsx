import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { useEffect, useRef, useState } from 'react';
import { Settings, X, Gift } from 'lucide-react';
import useCreditStore from '../stores/creditStore';
import CreditDepletedModal from './CreditDepletedModal';
import FeedbackModal from './FeedbackModal';

const navItems = [
  { to: '/app/experience', label: '경험 정리' },
  { to: '/app/portfolio', label: '포트폴리오' },
];

export default function Layout() {
  const { user, profile, signOut } = useAuthStore();
  const { wallet, loadWallet, refreshWallet, clearWallet } = useCreditStore();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditPanelOpen, setCreditPanelOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rewardPromptDismissed, setRewardPromptDismissed] = useState(false);
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
    navigate(path);
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f5]">
      <CreditDepletedModal open={creditModalOpen} onClose={() => setCreditModalOpen(false)} />
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
      <header className="bg-white border-b border-surface-200">
        <div className="relative px-6 flex items-center h-16">
          {/* 로고 */}
          <button onClick={() => navigate('/app')} className="flex items-center gap-2">
            <img src="/logo.png" alt="FitPoly" className="h-8 w-auto" />
          </button>

          {/* 메뉴 탭 - 절대 가운데 */}
          <nav className="absolute left-1/2 -translate-x-1/2 flex items-center bg-surface-100 rounded-full p-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-6 py-2 rounded-full text-sm font-semibold transition-all ${
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

          {/* 유저 */}
          <div className="ml-auto flex items-center gap-3">
            <div className="relative" ref={creditAreaRef}>
              <button
                type="button"
                onClick={() => setCreditPanelOpen(open => !open)}
                className="flex items-center gap-1 rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700 transition-colors hover:border-primary-200 hover:bg-primary-100"
                title="크레딧 현황"
                aria-expanded={creditPanelOpen}
              >
                <span className="text-primary-400">C</span>
                <span className="tabular-nums">{formattedCredits}</span>
              </button>

              {/* 크레딧 버튼 클릭 시: 잔여·사용 현황을 먼저 보여주고 관리 페이지로 유도 (불필요한 이탈 방지) */}
              {creditPanelOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-surface-200 bg-white p-4 shadow-xl z-[60]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-500">크레딧 현황</p>
                  <p className="mt-1 flex items-end gap-1 text-bluewood-900">
                    <span className="text-2xl font-extrabold tabular-nums">{formattedCredits}</span>
                    <span className="mb-0.5 text-sm font-bold text-bluewood-300">C 남음</span>
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
            <span className="text-sm font-medium text-bluewood-700">
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
                <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-lg border border-surface-200 bg-white py-1 shadow-xl">
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
              className="text-xs text-bluewood-400 hover:text-red-500 transition-colors ml-1"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto">
        <div className="w-full p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
