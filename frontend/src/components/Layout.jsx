import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

const navItems = [
  { to: '/app/experience', label: '경험 정리' },
  { to: '/app/portfolio', label: '포트폴리오' },
];

export default function Layout() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f5]">
      {/* 상단 네비게이션 */}
      <header className="bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          {/* 로고 */}
          <button onClick={() => navigate('/app')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">P</span>
            </div>
          </button>

          {/* 메뉴 탭 */}
          <nav className="flex items-center bg-surface-100 rounded-full p-1">
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
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-bluewood-700">
              {user?.displayName || '사용자'}
            </span>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full ring-2 ring-surface-200" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-bold ring-2 ring-surface-200">
                {(user?.displayName || '사')[0]}
              </div>
            )}
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
        <div className="max-w-6xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
