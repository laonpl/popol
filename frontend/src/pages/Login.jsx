import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Briefcase, Sparkles } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuthStore();
  const [mode, setMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('이메일과 비밀번호를 입력해주세요'); return; }
    if (mode === 'signup') {
      if (!displayName.trim()) { toast.error('이름을 입력해주세요'); return; }
      if (password.length < 6) { toast.error('비밀번호는 6자 이상이어야 합니다'); return; }
      if (password !== confirmPassword) { toast.error('비밀번호가 일치하지 않습니다'); return; }
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        toast.success('로그인 성공!');
        navigate('/app');
      } else {
        await signUpWithEmail(email, password, displayName.trim());
        toast.success('회원가입 성공! 프로필을 설정해주세요');
        navigate('/app/profile-setup');
      }
    } catch (err) {
      const code = err.code;
      if (code === 'auth/email-already-in-use') toast.error('이미 사용 중인 이메일입니다');
      else if (code === 'auth/invalid-email') toast.error('올바른 이메일을 입력해주세요');
      else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') toast.error('이메일 또는 비밀번호가 올바르지 않습니다');
      else if (code === 'auth/user-not-found') toast.error('등록되지 않은 이메일입니다');
      else if (code === 'auth/weak-password') toast.error('비밀번호는 6자 이상이어야 합니다');
      else toast.error(err.message || '오류가 발생했습니다');
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      const { profile } = useAuthStore.getState();
      if (profile) {
        toast.success('로그인 성공!');
        navigate('/app');
      } else {
        toast.success('로그인 성공! 프로필을 설정해주세요');
        navigate('/app/profile-setup');
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error('구글 로그인에 실패했습니다');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] via-white to-primary-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
              <Briefcase size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-bluewood-900">POPOL</h1>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-full text-sm font-medium border border-primary-100">
            <Sparkles size={14} />
            AI 기반 올인원 취업 준비 플랫폼
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-8">
          <h2 className="text-xl font-bold text-center mb-6 text-bluewood-900">
            {mode === 'login' ? '로그인' : '회원가입'}
          </h2>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 border border-surface-200 rounded-xl text-sm font-medium text-bluewood-700 hover:bg-surface-50 disabled:opacity-50 transition-colors mb-4"
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Google로 계속하기
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-surface-200"></div>
            <span className="text-xs text-gray-400">또는</span>
            <div className="flex-1 h-px bg-surface-200"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">이름</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full pl-10 pr-4 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">이메일</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">비밀번호</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="6자 이상"
                  className="w-full pl-10 pr-10 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">비밀번호 확인</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호를 다시 입력"
                    className="w-full pl-10 pr-4 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
                  />
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-5">
            {mode === 'login' ? (
              <>계정이 없으신가요? <button onClick={() => setMode('signup')} className="text-primary-600 font-medium hover:underline">회원가입</button></>
            ) : (
              <>이미 계정이 있으신가요? <button onClick={() => setMode('login')} className="text-primary-600 font-medium hover:underline">로그인</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
