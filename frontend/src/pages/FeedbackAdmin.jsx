import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../stores/authStore';

const DEFAULT_ADMIN_EMAIL = 'fitpoly.kr@gmail.com';

function adminEmails() {
  return (import.meta.env.VITE_ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL)
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

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

export default function FeedbackAdmin() {
  const { user } = useAuthStore();
  const isAdmin = useMemo(() => adminEmails().includes(String(user?.email || '').toLowerCase()), [user?.email]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { data } = await api.get('/feedback?limit=200');
      setItems(data.feedback || []);
    } catch (error) {
      toast.error(error.response?.data?.error || '피드백을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-surface-50 px-5 py-10">
        <div className="mx-auto max-w-xl rounded-lg border border-surface-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-500">Admin Only</p>
          <h1 className="mt-2 text-2xl font-extrabold text-bluewood-900">관리자만 확인할 수 있습니다</h1>
          <p className="mt-3 text-sm leading-6 text-bluewood-400">
            피드백 페이지는 {DEFAULT_ADMIN_EMAIL} 계정 또는 설정된 관리자 이메일만 접근할 수 있어요.
          </p>
          <Link to="/app" className="mt-5 inline-flex rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700">
            앱으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const average = items.length
    ? (items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length).toFixed(1)
    : '0.0';

  return (
    <main className="min-h-screen bg-surface-50 px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-500">Admin</p>
            <h1 className="mt-1 text-2xl font-extrabold text-bluewood-900">사용자 피드백</h1>
            <p className="mt-1 text-sm text-bluewood-400">경험 생성 이후 사용자가 남긴 별점과 코멘트입니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-bold text-bluewood-700">
              총 {items.length}개 · 평균 {average}점
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-bold text-bluewood-600 hover:border-primary-200 hover:text-primary-600 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              새로고침
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-bluewood-400">
              <Loader2 size={18} className="animate-spin" />
              불러오는 중
            </div>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm font-semibold text-bluewood-300">아직 피드백이 없습니다.</p>
          ) : (
            <div className="divide-y divide-surface-100">
              {items.map(item => (
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
    </main>
  );
}
