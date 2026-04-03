import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, FileText, PenTool,
  LogOut, User
} from 'lucide-react';
import useAuthStore from '../stores/authStore';

const navItems = [
  { to: '/app', icon: LayoutDashboard, label: '대시보드', end: true },
  { to: '/app/experience', icon: FolderOpen, label: '경험 정리' },
  { to: '/app/portfolio', icon: FileText, label: '포트폴리오' },
  { to: '/app/coverletter', icon: PenTool, label: '자기소개서' },
];

export default function Layout() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-surface-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-surface-200 flex flex-col">
        <div className="p-6 border-b border-surface-200">
          <h1 className="text-xl font-bold text-primary-600">POPOL</h1>
          <p className="text-xs text-gray-400 mt-1">스마트 포트폴리오 플랫폼</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-500 hover:bg-surface-100 hover:text-gray-700'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-surface-200">
          <div className="flex items-center gap-3 px-3 py-2">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <User size={16} className="text-primary-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.displayName || '사용자'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.isAnonymous ? '게스트' : user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 mt-2 w-full text-sm text-gray-500 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
