import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

/**
 * 서비스 전체 공유 링크 열람 현황.
 *
 * 목록은 shareLinks 의 누적 카운터로 만들고, 행을 펼쳐야 그 포트폴리오의
 * 열람 행동 상세를 따로 불러온다 (전체 이벤트를 최신순으로 훑으려면
 * 컬렉션 그룹 색인이 필요해서 목록 단계에서는 읽지 않는다).
 */

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'opened', label: '열람됨' },
  { key: 'today', label: '오늘 열람' },
  { key: 'unopened', label: '미열람' },
  { key: 'revoked', label: '차단됨' },
];

const DEVICE_LABEL = { mobile: '모바일', tablet: '태블릿', desktop: 'PC', unknown: '기타' };
const EVENT_LABEL = { view: '열람', depth: '스크롤', dwell: '체류', project_open: '프로젝트 열기' };

const fmtDateTime = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-';
};

const fmtDuration = (seconds) => {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}초`;
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
};

function Tile({ label, value, accent = false }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-bluewood-400">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums ${accent ? 'text-primary-600' : 'text-bluewood-900'}`}>{value}</p>
    </div>
  );
}

function eventSummary(event) {
  if (event.eventType === 'depth') return `${event.depth}%까지 스크롤`;
  if (event.eventType === 'dwell') return `${fmtDuration(event.seconds)} 머무름`;
  if (event.eventType === 'project_open') return `“${event.targetTitle}” 열어봄`;
  return [DEVICE_LABEL[event.device] || '기타', event.referrerHost && `${event.referrerHost} 유입`]
    .filter(Boolean)
    .join(' · ');
}

function LinkRow({ link, cred, onRevokeToggle, acting }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || detail || loadingDetail) return;
    setLoadingDetail(true);
    try {
      const { data } = await api.post('/admin/link-views/detail', {
        ...cred,
        portfolioId: link.portfolioId,
      });
      setDetail(data);
    } catch (error) {
      toast.error(error.response?.data?.error || '열람 상세를 불러오지 못했습니다.');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={toggle} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-bluewood-900">{link.label}</span>
            {link.revoked && <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[11px] font-bold text-bluewood-400">차단됨</span>}
            {!link.portfolioPublic && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-600">비공개</span>}
            {link.viewedToday && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600">오늘</span>}
          </div>
          <p className="mt-0.5 truncate text-xs text-bluewood-400">
            {link.ownerEmail || link.ownerUid} · {link.portfolioTitle}
          </p>
        </button>
        <div className="text-right">
          <p className="text-sm font-extrabold tabular-nums text-bluewood-900">{link.viewCount}회</p>
          <p className="text-[11px] text-bluewood-300">{link.lastViewedAt ? fmtDateTime(link.lastViewedAt) : '열람 없음'}</p>
        </div>
        <button
          type="button"
          onClick={() => onRevokeToggle(link)}
          disabled={acting}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
            link.revoked
              ? 'border-surface-200 text-bluewood-500 hover:border-primary-200 hover:text-primary-600'
              : 'border-surface-200 text-bluewood-400 hover:border-rose-200 hover:text-rose-500'
          }`}
        >
          {link.revoked ? '차단 해제' : '차단'}
        </button>
        <button type="button" onClick={toggle} className="shrink-0 text-xs font-bold text-bluewood-400 hover:text-primary-600">
          {open ? '접기' : '상세'}
        </button>
      </div>

      {open && (
        <div className="border-t border-surface-100 bg-surface-50/70 px-4 py-4">
          {loadingDetail ? (
            <p className="py-4 text-center text-xs font-semibold text-bluewood-400">불러오는 중</p>
          ) : !detail ? (
            <p className="py-4 text-center text-xs font-semibold text-bluewood-300">상세를 불러오지 못했습니다.</p>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-bold text-bluewood-400">
                포트폴리오 전체 기준 (이 링크만이 아니라 같은 포트폴리오의 모든 열람)
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ['열람', `${detail.totals.views}회`],
                  ['방문자', `${detail.totals.visitors}명`],
                  ['평균 체류', fmtDuration(detail.totals.avgDwellSeconds)],
                  ['최대 스크롤', detail.totals.maxDepth ? `${detail.totals.maxDepth}%` : '-'],
                  ['이벤트', `${detail.totals.events}건`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white px-3 py-2">
                    <p className="text-[11px] text-bluewood-400">{label}</p>
                    <p className="text-[13px] font-bold tabular-nums text-bluewood-800">{value}</p>
                  </div>
                ))}
              </div>

              {(detail.topProjects.length > 0 || detail.topReferrers.length > 0) && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {detail.topProjects.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold text-bluewood-500">많이 열어본 프로젝트</p>
                      {detail.topProjects.map(item => (
                        <p key={item.name} className="truncate text-xs text-bluewood-600">{item.name} · {item.count}회</p>
                      ))}
                    </div>
                  )}
                  {detail.topReferrers.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold text-bluewood-500">유입 경로</p>
                      {detail.topReferrers.map(item => (
                        <p key={item.name} className="truncate text-xs text-bluewood-600">{item.name} · {item.count}회</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="mb-1.5 mt-4 text-[11px] font-bold text-bluewood-500">최근 행동</p>
              {detail.recent.length === 0 ? (
                <p className="text-xs text-bluewood-300">기록된 열람이 없습니다.</p>
              ) : (
                <div className="divide-y divide-surface-200 overflow-hidden rounded-lg bg-white">
                  {detail.recent.map((event, index) => (
                    <div key={index} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <span className="mr-2 text-[11px] font-bold text-primary-600">{EVENT_LABEL[event.eventType] || event.eventType}</span>
                        <span className="text-xs text-bluewood-600">{eventSummary(event)}</span>
                        {event.linkLabel && <span className="ml-2 text-[11px] text-bluewood-300">{event.linkLabel}</span>}
                      </div>
                      <span className="text-[11px] tabular-nums text-bluewood-300">{fmtDateTime(event.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminLinkViews({ cred, onAuthError }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [actingId, setActingId] = useState(null);

  const load = async () => {
    if (!cred) return;
    setLoading(true);
    try {
      const res = await api.post('/admin/link-views', { ...cred });
      setData(res.data);
    } catch (error) {
      if (error.response?.status === 401) onAuthError?.();
      toast.error(error.response?.data?.error || error.message || '열람 현황을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revokeToggle = async (link) => {
    setActingId(link.id);
    try {
      await api.post('/admin/link-views/revoke', { ...cred, id: link.id, revoked: !link.revoked });
      toast.success(link.revoked ? '차단을 해제했습니다.' : '링크를 차단했습니다.');
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || '설정 변경에 실패했습니다.');
    } finally {
      setActingId(null);
    }
  };

  const summary = data?.summary;
  const allLinks = data?.links || [];
  const links = allLinks.filter(link => {
    if (filter === 'opened') return link.viewCount > 0;
    if (filter === 'today') return link.viewedToday;
    if (filter === 'unopened') return link.viewCount === 0;
    if (filter === 'revoked') return link.revoked;
    return true;
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex gap-1 rounded-lg border border-surface-200 bg-white p-1">
          {FILTERS.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${filter === item.key ? 'bg-primary-600 text-white' : 'text-bluewood-500 hover:text-bluewood-800'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-bold text-bluewood-600 hover:border-primary-200 hover:text-primary-600 disabled:opacity-50"
        >
          {loading ? '불러오는 중' : '새로고침'}
        </button>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Tile label="발급 링크" value={`${summary.totalLinks}개`} />
          <Tile label="열람된 링크" value={`${summary.openedLinks}개`} accent />
          <Tile label="링크 열람" value={`${summary.linkViews}회`} />
          <Tile label="오늘 열람" value={`${summary.viewedTodayLinks}개`} />
          <Tile label="전체 이벤트" value={summary.totalEvents == null ? '-' : `${summary.totalEvents}건`} />
        </div>
      )}

      {summary?.truncated && (
        <p className="mb-3 text-xs text-bluewood-400">최근 발급된 300개까지만 표시합니다.</p>
      )}

      <div className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
        {loading && allLinks.length === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-bluewood-400">불러오는 중</p>
        ) : links.length === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-bluewood-300">
            {allLinks.length === 0 ? '아직 발급된 공유 링크가 없습니다.' : '조건에 맞는 링크가 없습니다.'}
          </p>
        ) : (
          <div className="divide-y divide-surface-100">
            {links.map(link => (
              <LinkRow key={link.id} link={link} cred={cred} onRevokeToggle={revokeToggle} acting={actingId === link.id} />
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-bluewood-400">
        열람자의 IP는 저장하지 않으며 방문 식별자는 단방향 해시로만 보관합니다. 열람자 개인을 특정할 수 있는 정보는 여기에 없습니다.
      </p>
    </div>
  );
}
