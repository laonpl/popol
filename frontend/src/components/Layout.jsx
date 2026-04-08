import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, FileText, PenTool,
  LogOut, User, Briefcase
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
    <div className="flex h-screen bg-[#f0f4f8]">
      {/* Sidebar */}
      <aside className="w-[260px] bg-gradient-to-b from-bluewood-900 to-bluewood-800 text-white flex flex-col shadow-sidebar">
        <div className="px-6 py-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
              <Briefcase size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">POPOL</h1>
              <p className="text-[11px] text-bluewood-300 -mt-0.5">스마트 포트폴리오 플랫폼</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-bluewood-300 hover:bg-white/8 hover:text-white'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 mx-3 mb-3 rounded-xl bg-white/8">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full ring-2 ring-white/20" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-500/30 flex items-center justify-center ring-2 ring-primary-400/30">
                <User size={16} className="text-primary-200" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.displayName || '사용자'}</p>
              <p className="text-xs text-bluewood-400 truncate">{user?.isAnonymous ? '게스트 모드' : user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 mt-3 w-full text-xs text-bluewood-400 hover:text-red-300 rounded-lg hover:bg-white/5 transition-colors"
          >
            <LogOut size={14} />
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
