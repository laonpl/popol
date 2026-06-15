import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Trash2, AlertTriangle, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ko-KR') : '-';
}

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'server', label: '서버' },
  { key: 'client', label: '클라이언트' },
];

function SourceBadge({ source, path }) {
  const isServer = source === 'server';
  const label = isServer ? '서버' : (path === 'window' ? '브라우저' : path === 'promise' ? 'Promise' : path === 'api' ? 'API' : '클라이언트');
  return (
    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${isServer ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
      {label}
    </span>
  );
}

function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-4 py-3">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-start gap-3 text-left">
        <SourceBadge source={log.source} path={log.path} />
        {log.status != null && (
          <span className="shrink-0 rounded-md bg-surface-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-bluewood-500">
            {log.status}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-bluewood-800">{log.message}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-medium text-bluewood-300">
            <span>{formatDate(log.createdAt)}</span>
            {log.method && <span>· {log.method} {log.path}</span>}
            {log.userEmail && <span>· {log.userEmail}</span>}
          </p>
        </div>
        <ChevronDown size={16} className={`mt-0.5 shrink-0 text-bluewood-300 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg bg-surface-50 p-3 text-xs">
          {log.url && (
            <p className="break-all text-bluewood-500"><span className="font-bold text-bluewood-400">URL </span>{log.url}</p>
          )}
          {(log.userId || log.userAgent) && (
            <p className="break-all text-bluewood-400">
              {log.userId && <><span className="font-bold">UID </span>{log.userId}  </>}
              {log.userAgent && <><span className="font-bold">UA </span>{log.userAgent}</>}
            </p>
          )}
          {log.stack ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bluewood-900/95 p-3 text-[11px] leading-5 text-emerald-200">
              {log.stack}
            </pre>
          ) : (
            <p className="text-bluewood-300">스택 정보 없음</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminErrorLogs({ cred, onAuthError }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [clearing, setClearing] = useState(false);

  const load = async (source = filter) => {
    if (!cred) return;
    setLoading(true);
    try {
      const res = await api.post('/admin/error-logs', {
        ...cred,
        source: source === 'all' ? undefined : source,
        limit: 200,
      });
      setData(res.data);
    } catch (error) {
      if (error.response?.status === 401) onAuthError?.();
      toast.error(error.response?.data?.error || error.message || '오류 로그를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!window.confirm('수집된 오류 로그를 삭제할까요? (최대 500건씩 삭제)')) return;
    setClearing(true);
    try {
      const res = await api.post('/admin/error-logs/clear', { ...cred });
      toast.success(`${res.data.deleted}건 삭제${res.data.hasMore ? ' (남은 로그가 더 있어 한 번 더 실행하세요)' : ''}`);
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || '삭제에 실패했습니다.');
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const summary = data?.summary;
  const logs = data?.logs || [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex gap-1 rounded-lg border border-surface-200 bg-white p-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${filter === f.key ? 'bg-primary-600 text-white' : 'text-bluewood-500 hover:text-bluewood-800'}`}
            >
              {f.label}
              {summary && f.key !== 'all' && summary.bySource?.[f.key] != null && ` (${summary.bySource[f.key]})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-bold text-bluewood-600 hover:border-primary-200 hover:text-primary-600 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            새로고침
          </button>
          <button
            type="button"
            onClick={clearLogs}
            disabled={clearing || logs.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-bold text-bluewood-400 hover:border-rose-200 hover:text-rose-500 disabled:opacity-50"
          >
            {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            비우기
          </button>
        </div>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-bluewood-400">최근 수집</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-bluewood-900">{summary.total}건</p>
          </div>
          <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-bluewood-400">오늘</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-rose-600">{summary.today}건</p>
          </div>
          <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-bluewood-400">서버</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-bluewood-900">{summary.bySource?.server || 0}건</p>
          </div>
          <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-bluewood-400">클라이언트</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums text-bluewood-900">{summary.bySource?.client || 0}건</p>
          </div>
        </div>
      )}

      {summary?.topMessages?.length > 0 && (
        <div className="mb-4 rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-bluewood-700">
            <AlertTriangle size={15} className="text-amber-500" /> 자주 발생한 오류 TOP
          </p>
          <div className="space-y-1.5">
            {summary.topMessages.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="w-8 shrink-0 rounded bg-surface-100 px-1.5 py-0.5 text-center font-bold tabular-nums text-bluewood-500">{item.count}</span>
                <span className="truncate font-medium text-bluewood-600">{item.message || '(메시지 없음)'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-bluewood-400">
            <Loader2 size={18} className="animate-spin" /> 불러오는 중
          </div>
        ) : logs.length === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-bluewood-300">수집된 오류 로그가 없습니다. 👍</p>
        ) : (
          <div className="divide-y divide-surface-100">
            {logs.map(log => <LogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>
    </div>
  );
}
