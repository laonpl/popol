import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts';
import { Loader2, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const C = {
  primary: '#4f46e5',
  primarySoft: '#a5b4fc',
  blue: '#2563eb',
  good: '#10b981',
  warn: '#f59e0b',
  bad: '#f43f5e',
  grid: '#e5e7eb',
  axis: '#94a3b8',
};
const PIE_COLORS = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'];

function won(n) { return `${Number(n || 0).toLocaleString()}원`; }
function fmt(n) { return Number(n || 0).toLocaleString(); }

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ko-KR') : '-';
}

// 목표 대비 게이지 (lowerBetter=true면 값이 목표 이하일 때 달성)
function GoalBar({ label, value, goal, unit = '%', lowerBetter = false, hint }) {
  const achieved = lowerBetter ? value <= goal : value >= goal;
  const near = !achieved && (lowerBetter ? value <= goal * 1.3 : value >= goal * 0.8);
  const color = achieved ? C.good : near ? C.warn : C.bad;
  const ratio = lowerBetter
    ? Math.min(100, goal > 0 ? (goal / Math.max(value, 0.0001)) * 100 : 0)
    : Math.min(100, goal > 0 ? (value / goal) * 100 : 0);
  return (
    <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold text-bluewood-500">{label}</p>
        <span className="text-[11px] font-bold" style={{ color }}>{achieved ? '달성' : near ? '근접' : '미달'}</span>
      </div>
      <p className="mt-1 text-xl font-extrabold tabular-nums text-bluewood-900">
        {value}{unit}
        <span className="ml-1 text-xs font-semibold text-bluewood-300">/ 목표 {goal}{unit}</span>
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${ratio}%`, backgroundColor: color }} />
      </div>
      {hint && <p className="mt-1.5 text-[11px] font-medium text-bluewood-300">{hint}</p>}
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-bluewood-400">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums ${accent || 'text-bluewood-900'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs font-semibold text-bluewood-300">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, desc, children, height = 240 }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-bluewood-800">{title}</p>
      {desc && <p className="mt-0.5 mb-2 text-xs font-medium text-bluewood-300">{desc}</p>}
      <div style={{ width: '100%', height }} className="mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SectionTitle({ tag, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-600">{tag}</span>
      <h2 className="text-base font-extrabold text-bluewood-900">{children}</h2>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
  labelStyle: { fontWeight: 700, color: '#334155' },
};

export default function AdminDashboard({ cred, onAuthError }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!cred) return;
    setLoading(true);
    try {
      const res = await api.post('/admin/dashboard', { ...cred });
      setData(res.data);
    } catch (error) {
      if (error.response?.status === 401) onAuthError?.();
      toast.error(error.response?.data?.error || error.message || '대시보드를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm font-semibold text-bluewood-400">
        <Loader2 size={18} className="animate-spin" /> 지표 집계 중
      </div>
    );
  }
  if (!data) return null;

  const g = data.goals;

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-bluewood-300">
          {formatDate(data.generatedAt)} 기준 · 오늘 = KST 0시부터 · 표본 {data.acquisition.total}명
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

      {/* 오늘 요약 */}
      <section className="space-y-3">
        <SectionTitle tag="Today">오늘 한눈에</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="방문" value={`${data.today.visits}명`} accent="text-primary-600" />
          <Stat label="신규 가입" value={`${data.today.signups}명`} />
          <Stat label="경험정리 작성" value={`${data.today.experiences}건`} />
          <Stat label="크레딧 소모" value={`${fmt(data.today.creditsUsed)}`} />
          <Stat label="크레딧 충전" value={`+${fmt(data.today.creditsCharged)}`} />
          <Stat label="AI 원가(추정)" value={won(data.today.aiCostKrw)} />
        </div>
      </section>

      {/* 가설 판정 보드 */}
      <section className="space-y-3">
        <SectionTitle tag="검증">가설 목표 대비 (IR 2주 검증 임계값)</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <GoalBar label="활성화율 (가입→결과물)" value={data.activation.activationRate} goal={g.activationRate} />
          <GoalBar label="TTV 중앙값 (가입→첫 결과물)" value={data.activation.ttvMedianMin} goal={g.ttvMedianMin} unit="분" lowerBetter hint={`표본 ${data.activation.ttvSample}명`} />
          <GoalBar label="CSAT 만족도 (4점↑)" value={data.value.csatTop2Box} goal={g.csatTop2Box} hint={`응답 ${data.value.csatCount}건`} />
          <GoalBar label="재사용률 (2회차+)" value={data.retention.reuseRate} goal={g.reuseRate} hint={`${data.retention.reuseUsers}명`} />
          <GoalBar label="재접속률 (가입 후 재방문)" value={data.retention.returningRate} goal={g.d7Retention} hint="D7 리텐션 근사" />
          <GoalBar label="결제 전환 (결제/가입)" value={data.revenue.payConversionSignup} goal={g.payConversion} hint={`결제 ${data.revenue.payingUsers}명`} />
          <GoalBar label="매출총이익률" value={data.unitEconomics.grossMargin} goal={g.grossMargin} hint="매출 없으면 0" />
        </div>
      </section>

      {/* Acquisition */}
      <section className="space-y-3">
        <SectionTitle tag="Acquisition">획득 · 가입</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="누적 가입" value={`${data.acquisition.total}명`} accent="text-primary-600" />
          <Stat label="최근 7일" value={`+${data.acquisition.new7d}명`} />
          <Stat label="최근 30일" value={`+${data.acquisition.new30d}명`} />
          <Stat label="미접속(가입만)" value={`${data.acquisition.neverSignedIn}명`} />
        </div>
        <ChartCard title="주간 신규 가입 추세" desc="최근 8주 · 주(월요일) 시작 기준">
          <AreaChart data={data.acquisition.trend} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSignup" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="count" name="가입" stroke={C.primary} strokeWidth={2.5} fill="url(#gradSignup)" />
          </AreaChart>
        </ChartCard>
      </section>

      {/* Activation */}
      <section className="space-y-3">
        <SectionTitle tag="Activation">활성화 · 가치 도달</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="활성화 깔때기" desc="단계별 도달 회원 수 (가입 기준 전환율)" height={260}>
            <BarChart data={data.activation.funnel} layout="vertical" margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="step" width={72} tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v, n, p) => [`${v}명 (${p.payload.rate}%)`, '회원']} />
              <Bar dataKey="users" fill={C.primary} radius={[0, 6, 6, 0]}>
                <LabelList dataKey="rate" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
              </Bar>
            </BarChart>
          </ChartCard>
          <ChartCard title="TTV 분포 (가입→첫 AI 구조화)" desc={`중앙값 ${data.activation.ttvMedianMin}분 · P25 ${data.activation.ttvP25}분 · P75 ${data.activation.ttvP75}분`} height={260}>
            <BarChart data={data.activation.ttvBuckets} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v}명`, '도달']} />
              <Bar dataKey="count" fill={C.blue} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>
      </section>

      {/* 가치 (CSAT) */}
      <section className="space-y-3">
        <SectionTitle tag="가치">결과 만족도</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="피드백 별점 분포" desc={`평균 ${data.value.csatAvg}점 · 만족(4점↑) ${data.value.csatTop2Box}% · 응답 ${data.value.csatCount}건`} height={240}>
            <BarChart data={data.value.ratingDist} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="star" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v}건`, '응답']} />
              <Bar dataKey="count" fill={C.warn} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-5">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertCircle size={18} />
              <p className="text-sm font-bold">설문 기반 지표는 아직 수집 전</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-bluewood-500">
              검증 계획의 다음 지표는 별도 설문/계측이 있어야 측정됩니다. 현재 피드백은 별점·자유서술만 수집 중입니다.
            </p>
            <ul className="mt-3 space-y-1.5">
              {data.value.surveyPending.map(item => (
                <li key={item} className="flex items-center gap-2 text-xs font-semibold text-bluewood-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Retention */}
      <section className="space-y-3">
        <SectionTitle tag="Retention">지속 · 재방문</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="7일 활성 (WAU)" value={`${data.retention.active7}명`} sub={`${data.retention.active7Rate}%`} accent="text-primary-600" />
          <Stat label="30일 활성 (MAU)" value={`${data.retention.active30}명`} sub={`${data.retention.active30Rate}%`} />
          <Stat label="재접속 (가입후 재방문)" value={`${data.retention.returning}명`} sub={`${data.retention.returningRate}%`} />
          <Stat label="재사용 (2회차+)" value={`${data.retention.reuseUsers}명`} sub={`${data.retention.reuseRate}%`} />
        </div>
      </section>

      {/* Revenue */}
      <section className="space-y-3">
        <SectionTitle tag="Revenue">결제 · 매출</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="매출(누적)" value={won(data.revenue.revenue)} accent="text-primary-600" />
          <Stat label="결제 회원" value={`${data.revenue.payingUsers}명`} sub={`주문시도 ${data.revenue.orderUsers}명`} />
          <Stat label="결제 전환" value={`${data.revenue.payConversionSignup}%`} sub={`주문대비 ${data.revenue.payConversionOrder}%`} />
          <Stat label="ARPPU" value={won(data.revenue.arppu)} sub={`ARPU ${won(data.revenue.arpu)}`} />
        </div>
        {data.revenue.byPackage.length > 0 ? (
          <ChartCard title="패키지별 결제" desc="결제 완료 주문 기준" height={240}>
            <PieChart>
              <Pie data={data.revenue.byPackage} dataKey="count" nameKey="package" cx="50%" cy="50%" outerRadius={85} label={(e) => `${e.package} ${e.count}`}>
                {data.revenue.byPackage.map((entry, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v, n, p) => [`${v}건 · ${won(p.payload.revenue)}`, p.payload.package]} />
            </PieChart>
          </ChartCard>
        ) : (
          <p className="rounded-lg border border-dashed border-surface-300 bg-surface-50 px-4 py-6 text-center text-xs font-semibold text-bluewood-300">
            아직 결제 완료 건이 없습니다. (유료 베타 / Pre-sale 오픈 후 집계)
          </p>
        )}
      </section>

      {/* Referral + NSM */}
      <section className="space-y-3">
        <SectionTitle tag="NSM · Referral">북극성 지표 · 공유</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="공개 포트폴리오" value={`${data.referral.publicPortfolios}개`} accent="text-primary-600" />
          <Stat label="공개 비율" value={`${data.referral.publicRate}%`} sub="작성자 중 공개" />
          <Stat label="이번 주 내보내기" value={`${data.nsm.thisWeek}개`} />
          <Stat label="누적 포트폴리오" value={`${data.portfolios.total}개`} />
        </div>
        <ChartCard title="주간 포트폴리오 완성·내보내기 (NSM)" desc="북극성 지표 — 주간 산출물 도달 추세">
          <LineChart data={data.nsm.trend} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${v}개`, '내보내기']} />
            <Line type="monotone" dataKey="count" name="포트폴리오" stroke={C.good} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>
      </section>

      {/* 경험정리 + 주간 생성 */}
      <section className="space-y-3">
        <SectionTitle tag="경험정리">경험 정리 활동</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="총 작성" value={`${data.experiences.total}건`} accent="text-primary-600" />
          <Stat label="작성 회원" value={`${data.experiences.usersWithExperience}명`} sub={`전체 ${data.experiences.writeRate}%`} />
          <Stat label="AI 구조화 완료" value={`${data.experiences.structuredRate}%`} sub={`${data.experiences.structured}건`} />
          <Stat label="작성자당 평균" value={`${data.experiences.avgPerWriter}건`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="주간 경험정리 생성 추세" desc="최근 8주">
            <BarChart data={data.experiences.trend} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v}건`, '생성']} />
              <Bar dataKey="count" fill={C.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
          <ChartCard title="유저당 경험 수 분포" desc="작성 회원 기준" height={240}>
            <PieChart>
              <Pie
                data={Object.entries(data.experiences.distribution).map(([name, value]) => ({ name, value }))}
                dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85}
                label={(e) => e.value > 0 ? `${e.name} ${e.value}` : ''}
              >
                {Object.keys(data.experiences.distribution).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v}명`, n]} />
            </PieChart>
          </ChartCard>
        </div>
      </section>

      {/* 단위경제성 + 크레딧 */}
      <section className="space-y-3">
        <SectionTitle tag="Unit Economics">단위경제성 · 크레딧</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="누적 AI 원가" value={won(data.unitEconomics.aiCostKrw)} sub={`$${data.unitEconomics.aiCostUsd}`} />
          <Stat label="활성 1인당 AI원가" value={won(data.unitEconomics.costPerActiveUser)} sub="30일 활성 기준" />
          <Stat label="매출총이익률" value={`${data.unitEconomics.grossMargin}%`} sub={`환율 ${fmt(data.unitEconomics.usdToKrw)} · 수수료 ${(data.unitEconomics.feeAssumption * 100).toFixed(1)}%`} />
          <Stat label="크레딧 소모율" value={`${data.credits.usageRate}%`} sub={`사용 ${fmt(data.credits.totalUsed)} / 충전 ${fmt(data.credits.totalCharged)}`} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="크레딧 잔액합" value={fmt(data.credits.balance)} />
          <Stat label="누적 충전" value={fmt(data.credits.totalCharged)} />
          <Stat label="누적 사용" value={fmt(data.credits.totalUsed)} />
          <Stat label="누적 탈퇴 / 이탈율" value={`${data.churn.deletedTotal}명`} sub={`이탈율 ${data.churn.churnRate}% · 오늘 ${data.churn.deletedToday}명`} />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-bluewood-300">
          <TrendingUp size={13} /> AI 원가·마진은 거래 usdCost 합계와 가정 환율·수수료로 산출한 러프 추정입니다.
        </p>
      </section>
    </div>
  );
}
