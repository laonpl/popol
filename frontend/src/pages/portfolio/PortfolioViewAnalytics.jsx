import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

/**
 * 제출한 링크가 실제로 열렸는지 보여주는 화면.
 *
 * 열람자는 회원이 아니므로 "누가 봤는지"는 알 수 없다. 대신 사용자가 붙인
 * 제출처 라벨 단위로 열람 횟수·체류 시간·스크롤 깊이를 모아 보여준다.
 */

const fmtDateTime = (value) => {
  if (!value) return '기록 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '기록 없음';
  return date.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fmtDuration = (seconds) => {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}초`;
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
};

const DEVICE_LABEL = { mobile: '모바일', tablet: '태블릿', desktop: 'PC' };

function StatTile({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
      <p className="text-[12px] font-bold text-gray-400">{label}</p>
      <p className="mt-1.5 text-[26px] font-extrabold tracking-[-0.02em] text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-gray-400">{sub}</p>}
    </div>
  );
}

export default function PortfolioViewAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/analytics/portfolio/${id}`);
      setReport(data);
      setError('');
    } catch (err) {
      setError(err?.message || '열람 현황을 불러오지 못했습니다.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const linkUrl = (token) => `${window.location.origin}/p/${id}${token ? `?t=${token}` : ''}`;

  const createLink = async () => {
    const label = newLabel.trim();
    if (!label) { toast.error('제출처 이름을 입력해주세요.'); return; }
    setCreating(true);
    try {
      await api.post('/share-links', { portfolioId: id, label });
      setNewLabel('');
      await load();
      toast.success(`“${label}” 링크를 만들었습니다.`);
    } catch (err) {
      toast.error(err?.message || '링크 발급에 실패했습니다.');
    }
    setCreating(false);
  };

  const toggleRevoke = async (link) => {
    try {
      await api.patch(`/share-links/${link.shareLinkId}`, { revoked: !link.revoked });
      await load();
      toast.success(link.revoked ? '링크를 다시 열었습니다.' : '링크를 차단했습니다.');
    } catch (err) {
      toast.error(err?.message || '설정 변경에 실패했습니다.');
    }
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(linkUrl(link.token));
      setCopiedId(link.shareLinkId);
      toast.success('링크가 복사되었습니다.');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('링크 복사에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-400">열람 현황을 불러오는 중입니다…</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-[15px] font-bold text-gray-700">{error}</p>
        <button onClick={load} className="mt-4 rounded-xl bg-primary-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-primary-700">
          다시 시도
        </button>
      </div>
    );
  }

  const { totals, links = [], recent = [] } = report || {};

  return (
    <div className="mx-auto max-w-5xl animate-fadeIn pb-20">
      <button onClick={() => navigate(-1)} className="mb-5 text-[13px] font-bold text-gray-400 hover:text-gray-700">← 돌아가기</button>

      <header className="mb-6">
        <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-gray-900">제출한 링크 열람 현황</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
          제출처별로 링크를 따로 만들면 어느 곳에서 얼마나 봤는지 구분해서 확인할 수 있습니다.
          열람자가 누구인지는 알 수 없고, 열람 방식만 기록됩니다.
        </p>
        {!report?.isPublic && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800">
            이 포트폴리오는 현재 비공개입니다. 공개로 바꾸기 전까지 링크를 열어도 내용이 보이지 않고 열람도 기록되지 않습니다.
          </p>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="전체 열람" value={`${totals?.views || 0}회`} />
        <StatTile label="열람한 사람" value={`${totals?.visitorCount || 0}명`} sub="브라우저 기준 추정" />
        <StatTile label="평균 체류" value={fmtDuration(totals?.avgDwellSeconds)} />
        <StatTile label="마지막 열람" value={totals?.lastViewedAt ? fmtDateTime(totals.lastViewedAt) : '아직 없음'} />
      </div>
      {totals?.truncated && (
        <p className="mt-2 text-[12px] text-gray-400">최근 500건까지만 집계한 값입니다.</p>
      )}

      <section className="mt-8">
        <h2 className="text-[18px] font-extrabold text-gray-900">제출처별 링크</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value.slice(0, 40))}
            onKeyDown={(e) => { if (e.key === 'Enter') createLink(); }}
            placeholder="예: 카카오 지원"
            className="min-w-[220px] flex-1 rounded-xl border border-gray-200 px-4 py-3 text-[14px] outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-50"
          />
          <button
            onClick={createLink}
            disabled={creating}
            className="rounded-xl bg-primary-600 px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
          >
            {creating ? '만드는 중…' : '링크 만들기'}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {links.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-[13.5px] text-gray-400">
              아직 만든 링크가 없습니다. 제출처 이름을 넣고 링크를 만들어 지원서에 첨부해보세요.
            </p>
          )}
          {links.map(link => (
            <div key={link.shareLinkId || 'direct'} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[16px] font-extrabold text-gray-900">{link.label}</p>
                    {link.revoked && (
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11.5px] font-bold text-gray-500">차단됨</span>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] text-gray-400">
                    처음 열람 {fmtDateTime(link.firstViewedAt)} · 마지막 열람 {fmtDateTime(link.lastViewedAt)}
                  </p>
                </div>
                {link.shareLinkId && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => copyLink(link)}
                      className="rounded-xl border border-gray-200 px-3.5 py-2 text-[12.5px] font-bold text-gray-600 transition-colors hover:border-primary-200 hover:text-primary-600"
                    >
                      {copiedId === link.shareLinkId ? '복사됨' : '링크 복사'}
                    </button>
                    <button
                      onClick={() => toggleRevoke(link)}
                      className="rounded-xl px-3 py-2 text-[12.5px] font-bold text-gray-400 transition-colors hover:text-gray-700"
                    >
                      {link.revoked ? '차단 해제' : '차단'}
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['열람', `${link.views}회`],
                  ['열람한 사람', `${link.visitorCount}명`],
                  ['평균 체류', fmtDuration(link.avgDwellSeconds)],
                  ['최대 스크롤', link.maxDepth ? `${link.maxDepth}%` : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-gray-50 px-3.5 py-2.5">
                    <p className="text-[11.5px] font-bold text-gray-400">{label}</p>
                    <p className="mt-0.5 text-[15px] font-extrabold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>

              {link.topProjects?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[12px] font-bold text-gray-400">많이 열어본 프로젝트</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {link.topProjects.map(project => (
                      <span key={project.title} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-800">
                        {project.title} · {project.count}회
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[18px] font-extrabold text-gray-900">최근 열람</h2>
        {recent.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-[13.5px] text-gray-400">
            아직 열람 기록이 없습니다.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {recent.map((visit, index) => (
              <div key={index} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-gray-800">{visit.label}</p>
                  <p className="text-[12px] text-gray-400">
                    {DEVICE_LABEL[visit.device] || '기타'}
                    {visit.referrerHost && ` · ${visit.referrerHost} 에서 유입`}
                  </p>
                </div>
                <p className="text-[12.5px] text-gray-400">{fmtDateTime(visit.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-[12px] leading-relaxed text-gray-400">
        열람자의 IP 주소는 저장하지 않으며, 재방문 판별용 식별자는 되돌릴 수 없게 변환해 보관합니다.
        열람자 개인을 특정하는 정보는 수집하지 않습니다.
      </p>
    </div>
  );
}
