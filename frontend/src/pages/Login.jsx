import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ShieldCheck, RefreshCw } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';

// ── 6자리 OTP 입력 컴포넌트 ──────────────────────────────
function OtpInput({ value, onChange, disabled }) {
  const inputs = useRef([]);

  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1);
    const next = value.split('');
    next[i] = v;
    const joined = next.join('');
    onChange(joined);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, '').slice(0, 6));
      inputs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  };

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all
            ${value[i]
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-surface-200 bg-white text-bluewood-900'}
            focus:border-primary-400 focus:ring-2 focus:ring-primary-100
            disabled:opacity-50 disabled:cursor-not-allowed`}
        />
      ))}
    </div>
  );
}

// ── 메인 로그인 페이지 ───────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, requestOtp, verifyOtp } = useAuthStore();
  const user = useAuthStore(s => s.user);

  // 화면 단계: 'login' | 'signup' | 'otp'
  const [step, setStep] = useState('login');
  const [otpContext, setOtpContext] = useState('signup'); // 'signup' | 'login'

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP 관련
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null); // Date
  const [timeLeft, setTimeLeft] = useState(0); // 초

  // 이미 로그인됐지만 이메일 미인증 → OTP 단계로 자동 이동
  useEffect(() => {
    if (user && !user.emailVerified) {
      setEmail(user.email || '');
      setOtpContext('login');
      setStep('otp');
      setLoading(true);
      requestOtp()
        .then(res => {
          if (res.alreadyVerified) { navigate('/app'); return; }
          const expiresAt = new Date(Date.now() + (res.expiresInMinutes || 15) * 60 * 1000);
          setOtpExpiresAt(expiresAt);
          setTimeLeft((res.expiresInMinutes || 15) * 60);
          setResendCooldown(60);
        })
        .catch(err => {
          const wait = err.response?.data?.waitSeconds;
          if (wait) setResendCooldown(wait);
          toast.error(err.response?.data?.error || '인증 코드 발송에 실패했습니다');
        })
        .finally(() => setLoading(false));
    }
  }, []);

  // 만료 카운트다운 타이머
  useEffect(() => {
    if (!otpExpiresAt) return;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.round((otpExpiresAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [otpExpiresAt]);

  // 재발송 쿨다운 타이머
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // OTP 발송 요청 (최초 또는 재발송)
  const sendOtp = async () => {
    setLoading(true);
    try {
      const res = await requestOtp();
      if (res.alreadyVerified) {
        toast.success('이미 인증된 이메일입니다');
        navigate(otpContext === 'signup' ? '/app/profile-setup' : '/app');
        return;
      }
      const expiresAt = new Date(Date.now() + (res.expiresInMinutes || 15) * 60 * 1000);
      setOtpExpiresAt(expiresAt);
      setTimeLeft((res.expiresInMinutes || 15) * 60);
      setResendCooldown(60);
      setOtp('');
      toast.success(`인증 코드를 ${email}로 발송했습니다`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      const wait = err.response?.data?.waitSeconds;
      if (wait) setResendCooldown(wait);
      toast.error(msg || '이메일 발송에 실패했습니다');
    }
    setLoading(false);
  };

  // 회원가입 / 로그인 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('이메일과 비밀번호를 입력해주세요'); return; }
    if (step === 'signup') {
      if (!displayName.trim()) { toast.error('이름을 입력해주세요'); return; }
      if (password.length < 6) { toast.error('비밀번호는 6자 이상이어야 합니다'); return; }
      if (password !== confirmPassword) { toast.error('비밀번호가 일치하지 않습니다'); return; }
    }
    setLoading(true);
    try {
      if (step === 'login') {
        const user = await signInWithEmail(email, password);
        if (!user.emailVerified) {
          // 미인증 계정 → OTP 인증 단계로
          setOtpContext('login');
          setStep('otp');
          await sendOtp();
        } else {
          toast.success('로그인 성공!');
          navigate('/app');
        }
      } else {
        await signUpWithEmail(email, password, displayName.trim());
        setOtpContext('signup');
        setStep('otp');
        await sendOtp();
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

  // OTP 인증 제출
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { toast.error('6자리 코드를 모두 입력해주세요'); return; }
    setLoading(true);
    try {
      await verifyOtp(otp);
      toast.success('이메일 인증 완료!');
      if (otpContext === 'signup') {
        navigate('/app/profile-setup');
      } else {
        navigate('/app');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '인증에 실패했습니다';
      toast.error(msg);
      if (err.response?.data?.expired || err.response?.data?.maxAttempts) {
        setOtp('');
      }
    }
    setLoading(false);
  };

  // OTP 6자리 완성 시 자동 제출
  useEffect(() => {
    if (otp.length === 6 && step === 'otp') {
      handleVerifyOtp();
    }
  }, [otp]);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      // 리다이렉트 방식: 구글 인증 페이지로 이동하므로 이후 코드는 실행되지 않음
    } catch (err) {
      toast.error('구글 로그인에 실패했습니다');
      setLoading(false);
    }
  };

  // ── OTP 인증 화면 ────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] via-white to-primary-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-4">
              <img src="/logo.png" alt="FitPoly" className="h-10 w-auto" />
              <h1 className="text-2xl font-bold text-bluewood-900">FitPoly</h1>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-8">
            {/* 아이콘 + 제목 */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-50 rounded-2xl mb-4">
                <ShieldCheck size={28} className="text-primary-600" />
              </div>
              <h2 className="text-xl font-bold text-bluewood-900">이메일 인증</h2>
              <p className="text-sm text-gray-400 mt-1.5">
                <span className="font-medium text-bluewood-700">{email}</span>으로<br />
                발송된 6자리 코드를 입력하세요
              </p>
            </div>

            {/* 만료 타이머 */}
            {timeLeft > 0 && (
              <div className="flex items-center justify-center gap-1.5 mb-5 text-sm">
                <span className="text-gray-400">코드 만료까지</span>
                <span className={`font-bold tabular-nums ${timeLeft < 60 ? 'text-red-500' : 'text-primary-600'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}
            {timeLeft === 0 && otpExpiresAt && (
              <p className="text-center text-sm text-red-500 mb-5 font-medium">코드가 만료되었습니다. 재발송해주세요.</p>
            )}

            {/* OTP 입력 */}
            <div className="mb-6">
              <OtpInput value={otp} onChange={setOtp} disabled={loading || timeLeft === 0} />
            </div>

            {/* 인증 버튼 */}
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 6 || timeLeft === 0}
              className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors mb-4"
            >
              {loading ? '인증 중...' : '인증하기'}
            </button>

            {/* 재발송 */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={sendOtp}
                disabled={loading || resendCooldown > 0}
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                <RefreshCw size={14} />
                {resendCooldown > 0 ? `재발송 (${resendCooldown}초 후)` : '코드 재발송'}
              </button>
            </div>

            {/* 뒤로가기 */}
            <p className="text-center text-sm text-gray-400 mt-5">
              <button
                onClick={() => { setStep(otpContext === 'signup' ? 'signup' : 'login'); setOtp(''); }}
                className="text-primary-600 font-medium hover:underline"
              >
                ← 뒤로가기
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── 로그인 / 회원가입 화면 ────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] via-white to-primary-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <img src="/logo.png" alt="FitPoly" className="h-10 w-auto" />
            <h1 className="text-2xl font-bold text-bluewood-900">FitPoly</h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-8">
          <h2 className="text-xl font-bold text-center mb-6 text-bluewood-900">
            {step === 'login' ? '로그인' : '회원가입'}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 'signup' && (
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
            {step === 'signup' && (
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
              {loading ? '처리 중...' : step === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-5">
            {step === 'login' ? (
              <>계정이 없으신가요? <button onClick={() => setStep('signup')} className="text-primary-600 font-medium hover:underline">회원가입</button></>
            ) : (
              <>이미 계정이 있으신가요? <button onClick={() => setStep('login')} className="text-primary-600 font-medium hover:underline">로그인</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
