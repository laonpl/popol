import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { Loader2, RefreshCw, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const C = { primary: '#4f46e5', blue: '#2563eb', warn: '#f59e0b', grid: '#e5e7eb', axis: '#94a3b8' };

function fmt(n) { return Number(n || 0).toLocaleString(); }
function won(n) { return `${Number(n || 0).toLocaleString()}원`; }
function usd(n) { return `$${Number(n || 0).toFixed(4)}`; }
function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ko-KR') : '-';
}

const SORTS = [
  { key: 'totalUsdCost', label: '총 비용' },
  { key: 'count', label: '호출 수' },
  { key: 'avgTokens', label: '평균 토큰' },
  { key: 'maxTokens', label: '최대 토큰' },
  { key: 'avgCredits', label: '평균 크레딧' },
];

function Stat({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-bluewood-400">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums ${accent || 'text-bluewood-900'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs font-semibold text-bluewood-300">{sub}</p>}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
  labelStyle: { fontWeight: 700, color: '#334155' },
};

export default function AdminAiUsage({ cred, onAuthError }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState('totalUsdCost');

  const load = async () => {
    if (!cred) return;
    setLoading(true);
    try {
      const res = await api.post('/admin/ai-usage', { ...cred });
      setData(res.data);
    } catch (error) {
      if (error.response?.status === 401) onAuthError?.();
      toast.error(error.response?.data?.error || error.message || 'AI 사용량을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const operations = useMemo(() => {
    if (!data?.operations) return [];
    const operationSort = sort === 'users' ? 'totalUsdCost' : sort;
    return [...data.operations].sort((a, b) => (b[operationSort] || 0) - (a[operationSort] || 0));
  }, [data, sort]);

  const chartData = useMemo(
    () => operations.slice(0, 12).map(o => ({ name: o.label, avgTokens: o.avgTokens, maxTokens: o.maxTokens })),
    [operations]
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm font-semibold text-bluewood-400">
        <Loader2 size={18} className="animate-spin" /> AI 사용량 집계 중
      </div>
    );
  }
  if (!data) return null;

  const s = data.summary;
  const topUsers = data.topUsers || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-bluewood-300">
          {formatDate(data.generatedAt)} 기준 · 크레딧 단가 1 USD = {fmt(s.creditsPerUsd)} 크레딧
        </p>
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

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="AI 기능 수" value={`${s.operationCount}개`} accent="text-primary-600" />
        <Stat label="총 호출" value={`${fmt(s.totalCalls)}회`} />
        <Stat label="총 토큰" value={fmt(s.totalTokens)} />
        <Stat label="총 AI 원가" value={won(s.totalCostKrw)} sub={usd(s.totalUsdCost)} />
        <Stat label="총 차감 크레딧" value={fmt(s.totalCredits)} />
      </div>

      {/* 기능별 평균/최대 토큰 그래프 */}
      <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
        <p className="flex items-center gap-1.5 text-sm font-bold text-bluewood-800">
          <Cpu size={15} className="text-primary-500" /> 기능별 1회 토큰량 (평균 vs 최대)
        </p>
        <p className="mt-0.5 mb-2 text-xs font-medium text-bluewood-300">상위 12개 · 평균 대비 최대값 편차가 크면 프롬프트/입력 길이 점검 필요</p>
        <div style={{ width: '100%', height: Math.max(240, chartData.length * 34) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [`${fmt(v)} 토큰`, n === 'avgTokens' ? '평균' : '최대']} />
              <Bar dataKey="avgTokens" name="avgTokens" fill={C.primary} radius={[0, 4, 4, 0]} />
              <Bar dataKey="maxTokens" name="maxTokens" fill={C.warn} radius={[0, 4, 4, 0]} fillOpacity={0.55} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 정렬 + 상세 테이블 */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
        <span className="shrink-0 text-xs font-bold text-bluewood-400">정렬</span>
        {SORTS.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSort(item.key)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-bold ${sort === item.key ? 'bg-primary-600 text-white' : 'border border-surface-200 bg-white text-bluewood-500 hover:text-bluewood-800'}`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSort('users')}
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-bold ${sort === 'users' ? 'bg-primary-600 text-white' : 'border border-surface-200 bg-white text-bluewood-500 hover:text-bluewood-800'}`}
        >
          사용 유저
        </button>
      </div>

      {sort === 'users' ? (
        <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-left text-xs font-bold text-bluewood-400">
                <th className="px-4 py-3">순위</th>
                <th className="px-3 py-3">사용자 이메일</th>
                <th className="px-3 py-3 text-right">총 토큰</th>
                <th className="px-3 py-3 text-right">사용 크레딧</th>
                <th className="px-3 py-3 text-right">남은 크레딧</th>
                <th className="px-3 py-3 text-right">누적 사용</th>
                <th className="px-3 py-3 text-right">호출 수</th>
                <th className="px-3 py-3 text-right">평균 토큰</th>
                <th className="px-3 py-3 text-right">평균 크레딧</th>
                <th className="px-4 py-3">최근 사용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {topUsers.map(user => (
                <tr key={user.uid} className="hover:bg-surface-50">
                  <td className="px-4 py-3 font-extrabold tabular-nums text-primary-600">#{user.rank}</td>
                  <td className="max-w-[280px] truncate px-3 py-3 font-bold text-bluewood-800">{user.email}</td>
                  <td className="px-3 py-3 text-right font-extrabold tabular-nums text-primary-600">{fmt(user.totalTokens)}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-bluewood-800">{fmt(user.creditsUsed)} C</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-bluewood-700">{fmt(user.balance)} C</td>
                  <td className="px-3 py-3 text-right tabular-nums text-bluewood-500">{fmt(user.totalUsed)} C</td>
                  <td className="px-3 py-3 text-right tabular-nums text-bluewood-500">{fmt(user.usageCount)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-bluewood-500">{fmt(user.avgTokens)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-bluewood-500">{fmt(user.avgCredits)} C</td>
                  <td className="px-4 py-3 text-xs font-semibold text-bluewood-300">{formatDate(user.lastUsed)}</td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm font-semibold text-bluewood-300">
                    아직 AI 사용 유저 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-left text-xs font-bold text-bluewood-400">
                <th className="px-4 py-3">AI 기능</th>
                <th className="px-3 py-3 text-right">호출</th>
                <th className="px-3 py-3 text-right">평균 토큰</th>
                <th className="px-3 py-3 text-right">입력/출력 평균</th>
                <th className="px-3 py-3 text-right">1회 범위(min~max)</th>
                <th className="px-3 py-3 text-right">평균 비용</th>
                <th className="px-3 py-3 text-right">평균 크레딧</th>
                <th className="px-4 py-3">모델</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {operations.map(o => (
                <tr key={o.operation} className="hover:bg-surface-50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-bluewood-800">{o.label}</p>
                    <p className="mt-0.5 truncate text-[12px] font-medium text-bluewood-300" title={o.operation}>{o.operation}</p>
                    {o.lastUsed && <p className="text-[12px] text-bluewood-300">최근 {formatDate(o.lastUsed)}</p>}
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-bluewood-700">{fmt(o.count)}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-primary-600">{fmt(o.avgTokens)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-bluewood-500">
                    {fmt(o.avgInput)} / {fmt(o.avgOutput)}
                    {o.avgThinking > 0 && <span className="block text-[12px] text-bluewood-300">사고 {fmt(o.avgThinking)}</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-bluewood-500">
                    {fmt(o.minTokens)} ~ {fmt(o.maxTokens)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-bluewood-500">{usd(o.avgUsdCost)}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-bluewood-700">{fmt(o.avgCredits)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {o.models.length === 0 ? (
                        <span className="text-[12px] text-bluewood-300">-</span>
                      ) : o.models.map(m => (
                        <span key={m} className="rounded bg-surface-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-bluewood-500">{m}</span>
                      ))}
                    </div>
                    {o.estimatedCount > 0 && (
                      <p className="mt-1 text-[12px] text-amber-500">추정 {o.estimatedCount}회</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[12px] font-medium text-bluewood-300">
        ※ 토큰·비용은 usage 거래 로그 기준입니다. "추정"은 실제 토큰 수가 기록되지 않아 추정 차감된 호출이며 토큰 평균에서 제외됩니다.
      </p>
    </div>
  );
}
