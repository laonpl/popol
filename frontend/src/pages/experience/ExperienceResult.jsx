import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

/* 마크다운/플레이스홀더 정리 */
const isDraft = (v) => {
  const t = String(v || '').trim();
  if (!t) return true;
  if (t.startsWith('[작성 필요]') || t.startsWith('[검증 필요]')) return true;
  if (/\(예시\)/.test(t)) return true;
  if (/【[^】]*】/.test(t)) return true;
  if (/(공식에 맞춰|작성하세요|반영하세요|포함하세요|서술하세요|남기세요|적어주세요)/.test(t)) return true;
  return false;
};
const clean = (v) => isDraft(v) ? '' : String(v).replace(/\*\*/g, '').replace(/^#+\s/gm, '').trim();

const ACCENT = '#002F6C';

/* ──────────────────────────────────────────────────────────
   경험 결과 — 포트폴리오에 바로 쓰는 케이스스터디 한 장
   (앱 에디터 구성과 별개의 에디토리얼 레이아웃)
   ────────────────────────────────────────────────────────── */
export default function ExperienceResult() {
  const { id } = useParams();
  const { state } = useLocation();
  const [exp, setExp] = useState(state?.analysis ? { structuredResult: state.analysis, title: state.title } : null);
  const [loading, setLoading] = useState(!state?.analysis);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'experiences', id));
        if (snap.exists()) {
          const data = snap.data();
          setExp({ title: data.title, structuredResult: data.structuredResult || {}, keywords: data.keywords || [] });
        }
      } catch { /* keep navState */ }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="inline-block w-9 h-9 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    );
  }

  const sr = exp?.structuredResult || {};
  const ov = sr.projectOverview || {};
  const rawKeyExps = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
  const title = clean(exp?.title) || clean(ov.summary) || '경험 정리';
  const summary = clean(ov.summary) || clean(sr.intro);
  const background = clean(ov.background) || clean(ov.goal);

  const techStack = (ov.techStack && ov.techStack.length ? ov.techStack : []).map(t => (typeof t === 'string' ? t : t?.name || '')).filter(Boolean);
  const metaItems = [
    clean(ov.role) && { label: '역할', value: clean(ov.role) },
    clean(ov.duration) && { label: '기간', value: clean(ov.duration) },
    clean(ov.team) && { label: '팀', value: clean(ov.team) },
  ].filter(Boolean);

  // 내용 있는 핵심 경험만 (제목만 있는 빈 항목은 숨김)
  const keyExps = rawKeyExps
    .map(k => ({
      title: clean(k.title),
      ctx: clean(k.context || k.situation),
      action: clean(k.action),
      result: clean(k.result),
      learning: clean(k.learning),
      metric: clean(k.metric),
      metricLabel: clean(k.metricLabel),
      before: clean(k.beforeMetric),
      after: clean(k.afterMetric),
      kws: (k.keywords || []).map(clean).filter(Boolean),
    }))
    .filter(k => k.ctx || k.action || k.result || k.learning || k.metric);
  const droppedCount = rawKeyExps.length - keyExps.length;

  // 성과 지표 (정량) — 수치 부각용
  const metricCards = keyExps
    .filter(k => k.metric)
    .slice(0, 4)
    .map(k => ({ metric: k.metric, label: k.metricLabel || k.title, before: k.before, after: k.after }));

  const skills = [...new Set([
    ...keyExps.flatMap(k => k.kws),
    ...(exp?.keywords || sr.keywords || []).map(clean),
  ].filter(Boolean))];
  const competency = clean(sr.competency);

  const hasContent = keyExps.length > 0 || summary || metricCards.length > 0;
  const incomplete = droppedCount > 0 || metricCards.length === 0;

  return (
    <div className="min-h-screen bg-white">
      {/* 상단 액션 바 */}
      <div className="max-w-3xl mx-auto px-5 sm:px-8 pt-6 flex items-center justify-between text-[13px]">
        <Link to="/app/experience" className="font-medium text-bluewood-400 hover:text-bluewood-700 transition-colors">← 경험 목록</Link>
        <Link to={`/app/experience/structured/${id}`} className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">정리 다듬기 · 내보내기 →</Link>
      </div>

      {!hasContent ? (
        <div className="max-w-3xl mx-auto px-8 py-24 text-center">
          <p className="text-[15px] text-bluewood-400 mb-5">아직 정리된 내용이 없어요. 답변을 보강하면 케이스 스터디가 완성됩니다.</p>
          <Link to={`/app/experience/structured/${id}`} className="inline-block px-5 py-3 rounded-xl bg-primary-600 text-white text-[14px] font-bold hover:bg-primary-700 transition-colors">정리 다듬기</Link>
        </div>
      ) : (
        <article className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-12">

          {/* ── 히어로 ── */}
          <p className="text-[12px] font-black uppercase tracking-[0.22em] mb-4" style={{ color: ACCENT }}>CASE STUDY</p>
          <h1 className="text-[30px] sm:text-[40px] font-black leading-[1.18] text-bluewood-900 tracking-tight" style={{ wordBreak: 'keep-all' }}>
            {title}
          </h1>
          {summary && (
            <p className="mt-5 text-[16px] sm:text-[18px] leading-[1.6] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
              {summary}
            </p>
          )}

          {(metaItems.length > 0 || techStack.length > 0) && (
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              {metaItems.map(m => (
                <div key={m.label} className="flex items-baseline gap-1.5">
                  <span className="text-[11px] font-bold text-bluewood-300">{m.label}</span>
                  <span className="text-[13.5px] font-semibold text-bluewood-700">{m.value}</span>
                </div>
              ))}
              {techStack.slice(0, 8).map((t, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md bg-surface-100 text-[12px] font-semibold text-bluewood-600">{t}</span>
              ))}
            </div>
          )}

          {/* ── 성과 지표 — 대시보드처럼 크게 ── */}
          {metricCards.length > 0 && (
            <section className="mt-9 rounded-2xl border border-surface-200 bg-surface-50/50 px-6 sm:px-8 py-7">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-bluewood-400 mb-5">성과 지표</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-7">
                {metricCards.map((m, i) => (
                  <div key={i}>
                    <div className="text-[32px] sm:text-[40px] font-black leading-[1.05] tracking-tight" style={{ color: ACCENT, wordBreak: 'keep-all' }}>{m.metric}</div>
                    {m.label && <p className="mt-2 text-[12.5px] font-medium text-bluewood-500 leading-snug" style={{ wordBreak: 'keep-all' }}>{m.label}</p>}
                    {(m.before && m.after) && (
                      <p className="mt-1.5 text-[12px] text-bluewood-400">{m.before} <span className="mx-0.5 text-bluewood-300">→</span> <span className="font-bold" style={{ color: ACCENT }}>{m.after}</span></p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── 배경 ── */}
          {background && background !== summary && (
            <section className="mt-10">
              <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-bluewood-400 mb-3">배경</h2>
              <p className="text-[15px] leading-[1.8] text-bluewood-600" style={{ wordBreak: 'keep-all' }}>{background}</p>
            </section>
          )}

          {/* ── 핵심 경험 (내용 있는 것만, 카드형) ── */}
          {keyExps.length > 0 && (
            <section className="mt-11">
              <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-bluewood-400 mb-5">핵심 경험</h2>
              <div className="space-y-5">
                {keyExps.map((k, i) => {
                  const rows = [
                    k.ctx && { label: '문제', value: k.ctx },
                    k.action && { label: '실행', value: k.action },
                    k.result && { label: '결과', value: k.result, strong: true },
                    k.learning && { label: '배운 점', value: k.learning },
                  ].filter(Boolean);
                  return (
                    <div key={i} className="rounded-2xl border border-surface-200 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="flex-shrink-0 w-6 h-6 rounded-md text-white text-[12px] font-black flex items-center justify-center mt-0.5" style={{ backgroundColor: ACCENT }}>{i + 1}</span>
                          <h3 className="text-[18px] sm:text-[21px] font-extrabold leading-snug text-bluewood-900" style={{ wordBreak: 'keep-all' }}>
                            {k.title || `핵심 경험 ${i + 1}`}
                          </h3>
                        </div>
                        {k.metric && (
                          <span className="flex-shrink-0 text-[15px] font-black px-3 py-1.5 rounded-lg text-white whitespace-nowrap" style={{ backgroundColor: ACCENT }}>
                            {k.metric}
                          </span>
                        )}
                      </div>
                      {rows.length > 0 && (
                        <div className="space-y-3">
                          {rows.map(r => (
                            <div key={r.label} className="grid grid-cols-[52px_1fr] gap-3 items-baseline">
                              <span className="text-[11.5px] font-bold text-bluewood-400 pt-0.5">{r.label}</span>
                              <p className={`text-[14.5px] leading-[1.75] ${r.strong ? 'font-semibold text-bluewood-900' : 'text-bluewood-600'}`} style={{ wordBreak: 'keep-all' }}>
                                {r.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      {k.kws.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5 pl-[64px]">
                          {k.kws.map((kw, ki) => (
                            <span key={ki} className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold" style={{ backgroundColor: `${ACCENT}0f`, color: ACCENT }}>{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── 역량 ── */}
          {(skills.length > 0 || competency) && (
            <section className="mt-11 border-t border-surface-200 pt-9">
              <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-bluewood-400 mb-4">역량</h2>
              {competency && (
                <p className="text-[15px] leading-[1.8] text-bluewood-600 mb-4" style={{ wordBreak: 'keep-all' }}>{competency}</p>
              )}
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {skills.map((s, i) => (
                    <span key={i} className="px-3.5 py-1.5 rounded-full border border-surface-200 text-[13px] font-semibold text-bluewood-700">{s}</span>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── 미완성 안내 (빈칸을 늘어놓지 않고 한 줄로) ── */}
          {incomplete && (
            <div className="mt-10 rounded-xl bg-primary-50/60 border border-primary-100 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-bluewood-600 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                {metricCards.length === 0
                  ? '수치를 더하면 훨씬 강해져요. 답변에 전/후 숫자(예: 800ms→480ms)를 넣어 보강해 보세요.'
                  : `비어 있는 항목 ${droppedCount}개를 채우면 케이스 스터디가 더 완성돼요.`}
              </p>
              <Link to={`/app/experience/structured/${id}`} className="flex-shrink-0 px-4 py-2 rounded-lg bg-primary-600 text-white text-[13px] font-bold hover:bg-primary-700 transition-colors">보강하기</Link>
            </div>
          )}

          {/* 하단 CTA */}
          <div className="mt-10 flex flex-wrap gap-3 border-t border-surface-200 pt-8">
            <Link to={`/app/experience/structured/${id}`} className="px-5 py-3 rounded-xl bg-primary-600 text-white text-[14px] font-bold hover:bg-primary-700 transition-colors">
              정리 다듬기 · 포트폴리오로 내보내기
            </Link>
            <Link to="/app/experience" className="px-5 py-3 rounded-xl bg-white border border-surface-200 text-bluewood-700 text-[14px] font-bold hover:bg-surface-50 transition-colors">
              경험 목록으로
            </Link>
          </div>
        </article>
      )}
    </div>
  );
}
