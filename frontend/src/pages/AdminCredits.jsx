import { useEffect, useState } from 'react';
import { Loader2, Wallet, LogOut, RefreshCw, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import AdminDashboard from './AdminDashboard';
import AdminErrorLogs from './AdminErrorLogs';

const QUICK_AMOUNTS = [1000, 5000, 12000, 17000];

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ko-KR') : '-';
}

function Rating({ value }) {
  return (
    <div className="flex items-center gap-0.5 text-amber-400" aria-label={`${value}점`}>
      {[1, 2, 3, 4, 5].map(item => (
        <Star key={item} size={15} fill={item <= value ? 'currentColor' : 'none'} />
      ))}
    </div>
  );
}

export default function AdminCredits() {
  const [cred, setCred] = useState(() => {
    try {
      const saved = sessionStorage.getItem('adminCred');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // 로그인 폼
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState('dashboard');

  // 충전 폼
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [granting, setGranting] = useState(false);
  const [result, setResult] = useState(null);

  // 피드백
  const [feedback, setFeedback] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // 충전 요청
  const [requests, setRequests] = useState([]);
  const [actingId, setActingId] = useState(null);

  // 사용자 조회
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupData, setLookupData] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);

  const loadFeedback = async () => {
    if (!cred) return;
    setLoadingFeedback(true);
    try {
      const { data } = await api.post('/admin/feedback', { ...cred, limit: 200 });
      setFeedback(data.feedback || []);
    } catch (error) {
      if (error.response?.status === 401) logout();
      toast.error(error.response?.data?.error || error.message || '피드백을 불러오지 못했습니다.');
    } finally {
      setLoadingFeedback(false);
    }
  };

  const loadRequests = async () => {
    if (!cred) return;
    try {
      const { data } = await api.post('/admin/credit-requests', { ...cred });
      setRequests(data.requests || []);
    } catch (error) {
      if (error.response?.status === 401) logout();
    }
  };

  const approveRequest = async (id) => {
    setActingId(id);
    try {
      const { data } = await api.post('/admin/credit-requests/approve', { ...cred, id });
      if (data.skipped) toast(`이미 처리된 요청입니다 (${data.status}).`);
      else toast.success(`${data.email} 에 ${Number(data.amount).toLocaleString()} 크레딧 충전 완료`);
      loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || '충전에 실패했습니다.');
    } finally {
      setActingId(null);
    }
  };

  const rejectRequest = async (id) => {
    setActingId(id);
    try {
      await api.post('/admin/credit-requests/reject', { ...cred, id });
      loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || '거절에 실패했습니다.');
    } finally {
      setActingId(null);
    }
  };

  useEffect(() => {
    if (cred && tab === 'feedback' && feedback.length === 0) loadFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cred, tab]);

  // 충전 요청 탭: 자동 갱신(10초)으로 새 요청을 바로 표시
  useEffect(() => {
    if (!cred || tab !== 'requests') return;
    loadRequests();
    const timer = setInterval(loadRequests, 10000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cred, tab]);

  const lookupUser = async (e) => {
    e.preventDefault();
    if (!lookupEmail.trim()) {
      toast.error('조회할 이메일을 입력해주세요.');
      return;
    }
    setLookingUp(true);
    setLookupData(null);
    try {
      const { data } = await api.post('/admin/user-lookup', { ...cred, email: lookupEmail.trim() });
      setLookupData(data);
    } catch (error) {
      if (error.response?.status === 401) logout();
      toast.error(error.response?.data?.error || error.message || '조회에 실패했습니다.');
    } finally {
      setLookingUp(false);
    }
  };

  // 조회한 사용자를 충전 폼에 채워 환불로 이어준다.
  const refundLookupUser = () => {
    if (!lookupData) return;
    setEmail(lookupData.email);
    setTab('credits');
    toast('환불할 크레딧 금액을 입력한 뒤 충전하세요.');
  };

  const login = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      await api.post('/admin/login', { username, password });
      const next = { username, password };
      sessionStorage.setItem('adminCred', JSON.stringify(next));
      setCred(next);
      setPassword('');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || '로그인에 실패했습니다.');
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('adminCred');
    setCred(null);
    setResult(null);
    setReason('');
    setFeedback([]);
    setRequests([]);
    setLookupData(null);
    setTab('dashboard');
  };

  const grant = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!email.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error('이메일과 1 이상의 크레딧 수량을 입력해주세요.');
      return;
    }
    setGranting(true);
    setResult(null);
    try {
      const { data } = await api.post('/admin/grant-credits', {
        ...cred,
        email: email.trim(),
        amount: value,
        reason: reason.trim(),
      });
      setResult(data);
      toast.success(`${data.email} 에 ${data.amount} 크레딧 충전 완료`);
      setAmount('');
      setReason('');
    } catch (error) {
      if (error.response?.status === 401) logout();
      toast.error(error.response?.data?.error || error.message || '충전에 실패했습니다.');
    } finally {
      setGranting(false);
    }
  };

  if (!cred) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface-50 px-5">
        <form onSubmit={login} className="w-full max-w-sm rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-500">Admin</p>
          <h1 className="mt-1 text-2xl font-extrabold text-bluewood-900">크레딧 관리자</h1>
          <p className="mt-1 mb-5 text-sm text-bluewood-400">아이디와 비밀번호로 로그인하세요.</p>
          <label className="block text-sm font-bold text-bluewood-700">아이디</label>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="mt-1 mb-3 w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
          />
          <label className="block text-sm font-bold text-bluewood-700">비밀번호</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mt-1 mb-5 w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
          />
          <button
            type="submit"
            disabled={loggingIn}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loggingIn && <Loader2 size={16} className="animate-spin" />}
            로그인
          </button>
        </form>
      </main>
    );
  }

  const tabClass = (key) =>
    `px-4 py-2 text-sm font-bold rounded-lg ${
      tab === key ? 'bg-primary-600 text-white' : 'text-bluewood-500 hover:text-bluewood-800'
    }`;

  return (
    <main className="min-h-screen bg-surface-50 px-5 py-10">
      <div className={`mx-auto ${tab === 'dashboard' ? 'max-w-6xl' : tab === 'errors' ? 'max-w-4xl' : 'max-w-3xl'}`}>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-500">Admin</p>
            <h1 className="mt-1 text-2xl font-extrabold text-bluewood-900">관리자</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-bold text-bluewood-500 hover:text-bluewood-800"
          >
            <LogOut size={15} /> 로그아웃
          </button>
        </div>

        <div className="mb-6 inline-flex gap-1 rounded-xl border border-surface-200 bg-white p-1 shadow-sm">
          <button type="button" onClick={() => setTab('dashboard')} className={tabClass('dashboard')}>대시보드</button>
          <button type="button" onClick={() => setTab('credits')} className={tabClass('credits')}>크레딧 충전</button>
          <button type="button" onClick={() => setTab('lookup')} className={tabClass('lookup')}>사용자 조회</button>
          <button type="button" onClick={() => setTab('requests')} className={tabClass('requests')}>
            충전 요청{requests.filter(r => r.status === 'pending').length > 0 && ` (${requests.filter(r => r.status === 'pending').length})`}
          </button>
          <button type="button" onClick={() => setTab('feedback')} className={tabClass('feedback')}>피드백</button>
          <button type="button" onClick={() => setTab('errors')} className={tabClass('errors')}>오류 로그</button>
        </div>

        {tab === 'dashboard' && <AdminDashboard cred={cred} onAuthError={logout} />}

        {tab === 'errors' && <AdminErrorLogs cred={cred} onAuthError={logout} />}

        {tab === 'credits' && (
        <div className="max-w-lg">
        <form onSubmit={grant} className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-bold text-bluewood-700">사용자 이메일</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="mt-1 mb-4 w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
          />
          <label className="block text-sm font-bold text-bluewood-700">충전할 크레딧</label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="예: 12000"
            className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
          />
          <div className="mt-2 mb-4 flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(String(value))}
                className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-bold text-bluewood-600 hover:border-primary-300 hover:text-primary-600"
              >
                +{value.toLocaleString()}
              </button>
            ))}
          </div>
          <label className="block text-sm font-bold text-bluewood-700">
            충전 메시지 <span className="font-medium text-bluewood-300">(선택 · 사용자 내역에 표시됨)</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            maxLength={100}
            placeholder="예: 오류로 차감된 크레딧 환불, 이벤트 보상"
            className="mt-1 mb-2 w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
          />
          <div className="mb-5 flex flex-wrap gap-2">
            {['오류로 차감된 크레딧 환불', '이벤트 보상', '서비스 사과 크레딧'].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-bold text-bluewood-600 hover:border-primary-300 hover:text-primary-600"
              >
                {preset}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={granting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {granting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
            크레딧 충전
          </button>
        </form>

        {result && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-bold">{result.email} 충전 완료</p>
            <p className="mt-1">
              잔액 {Number(result.before).toLocaleString()} → {Number(result.after).toLocaleString()}
              {' '}(+{Number(result.amount).toLocaleString()})
            </p>
          </div>
        )}
        </div>
        )}

        {tab === 'lookup' && (
        <div>
          <form onSubmit={lookupUser} className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={lookupEmail}
              onChange={e => setLookupEmail(e.target.value)}
              placeholder="조회할 사용자 이메일"
              className="flex-1 rounded-lg border border-surface-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
            />
            <button
              type="submit"
              disabled={lookingUp}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {lookingUp ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              조회
            </button>
          </form>

          {lookupData && (
            <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-surface-100 pb-4">
                <div>
                  <p className="text-sm font-bold text-bluewood-800">{lookupData.email}</p>
                  <p className="mt-0.5 text-xs text-bluewood-300">{lookupData.uid}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    <span className="font-bold text-primary-600">잔액 {Number(lookupData.balance).toLocaleString()} C</span>
                    <span className="text-bluewood-400">누적 충전 {Number(lookupData.totalCharged).toLocaleString()}</span>
                    <span className="text-bluewood-400">누적 사용 {Number(lookupData.totalUsed).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={refundLookupUser}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-bold text-white hover:bg-primary-700"
                >
                  <Wallet size={15} /> 이 사용자 환불
                </button>
              </div>

              <p className="mt-4 mb-2 text-sm font-bold text-bluewood-700">최근 거래내역 ({lookupData.transactions.length})</p>
              {lookupData.transactions.length === 0 ? (
                <p className="py-8 text-center text-sm font-semibold text-bluewood-300">거래내역이 없습니다.</p>
              ) : (
                <div className="divide-y divide-surface-100">
                  {lookupData.transactions.map(item => (
                    <div key={item.id} className="grid items-center gap-3 py-2.5 md:grid-cols-[minmax(0,1fr)_170px_110px_120px]">
                      <p className="truncate text-sm font-semibold text-bluewood-700">{item.description || item.type}</p>
                      <p className="text-xs font-semibold text-bluewood-300">{formatDate(item.createdAt)}</p>
                      <p className={`text-sm font-bold tabular-nums ${Number(item.amount) >= 0 ? 'text-primary-600' : 'text-bluewood-600'}`}>
                        {Number(item.amount) >= 0 ? '+' : ''}{Number(item.amount || 0).toLocaleString()} C
                      </p>
                      <p className="text-xs text-bluewood-300 tabular-nums">잔액 {Number(item.balanceAfter || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {tab === 'requests' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-bluewood-700">
              대기 {requests.filter(r => r.status === 'pending').length}건 · 전체 {requests.length}건
              <span className="ml-2 text-xs font-semibold text-bluewood-300">10초마다 자동 갱신</span>
            </p>
            <button
              type="button"
              onClick={loadRequests}
              className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-bold text-bluewood-600 hover:border-primary-200 hover:text-primary-600"
            >
              <RefreshCw size={16} /> 새로고침
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
            {requests.length === 0 ? (
              <p className="py-16 text-center text-sm font-semibold text-bluewood-300">충전 요청이 없습니다.</p>
            ) : (
              <div className="divide-y divide-surface-100">
                {requests.map(item => (
                  <div key={item.id} className="grid items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_110px_110px_160px_140px]">
                    <p className="truncate text-sm font-bold text-bluewood-800">{item.email || '이메일 없음'}</p>
                    <p className="text-sm font-bold text-primary-600 tabular-nums">{Number(item.credits || 0).toLocaleString()} C</p>
                    <p className="text-sm text-bluewood-500 tabular-nums">{Number(item.price || 0).toLocaleString()}원</p>
                    <p className="text-xs font-semibold text-bluewood-300">{formatDate(item.createdAt)}</p>
                    <div className="flex justify-end gap-2">
                      {item.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            disabled={actingId === item.id}
                            onClick={() => approveRequest(item.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            {actingId === item.id ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}
                            충전
                          </button>
                          <button
                            type="button"
                            disabled={actingId === item.id}
                            onClick={() => rejectRequest(item.id)}
                            className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-bold text-bluewood-400 hover:text-rose-500 disabled:opacity-50"
                          >
                            거절
                          </button>
                        </>
                      ) : (
                        <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${item.status === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-surface-100 text-bluewood-400'}`}>
                          {item.status === 'done' ? '충전 완료' : '거절됨'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {tab === 'feedback' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-bluewood-700">
              총 {feedback.length}개
              {feedback.length > 0 && (
                <> · 평균 {(feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / feedback.length).toFixed(1)}점</>
              )}
            </p>
            <button
              type="button"
              onClick={loadFeedback}
              disabled={loadingFeedback}
              className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-bold text-bluewood-600 hover:border-primary-200 hover:text-primary-600 disabled:opacity-50"
            >
              {loadingFeedback ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              새로고침
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
            {loadingFeedback && feedback.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-bluewood-400">
                <Loader2 size={18} className="animate-spin" /> 불러오는 중
              </div>
            ) : feedback.length === 0 ? (
              <p className="py-16 text-center text-sm font-semibold text-bluewood-300">아직 피드백이 없습니다.</p>
            ) : (
              <div className="divide-y divide-surface-100">
                {feedback.map(item => (
                  <article key={item.id} className="grid gap-3 px-4 py-4 md:grid-cols-[150px_160px_minmax(0,1fr)]">
                    <div>
                      <Rating value={Number(item.rating || 0)} />
                      <p className="mt-1 text-xs font-semibold text-bluewood-300">{formatDate(item.createdAt)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-bluewood-800">{item.userEmail || '이메일 없음'}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-bluewood-300">{item.context || '-'}</p>
                      {item.experienceId && <p className="mt-1 truncate text-xs text-bluewood-300">경험 {item.experienceId}</p>}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-bluewood-600">{item.feedback}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </main>
  );
}
