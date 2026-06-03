import { useState, useEffect } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../config/firebase';
import useExperienceStore from '../../stores/experienceStore';

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

// 포트폴리오 내보내기용 7개 서술 섹션 라벨/순서 (StructuredResult와 동일)
const EXPORT_SECTION_LABELS = {
  intro: '프로젝트 소개', overview: '프로젝트 개요', task: '진행한 일',
  process: '과정', output: '결과물', growth: '성장한 점', competency: '역량',
};
const EXPORT_SECTION_ORDER = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];

/* ──────────────────────────────────────────────────────────
   경험 결과 — 포트폴리오에 바로 쓰는 케이스스터디 한 장
   (앱 에디터 구성과 별개의 에디토리얼 레이아웃)
   ────────────────────────────────────────────────────────── */
export default function ExperienceResult() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const analyzeExperience = useExperienceStore(s => s.analyzeExperience);
  const [exp, setExp] = useState(state?.analysis ? { structuredResult: state.analysis, title: state.title } : null);
  const [loading, setLoading] = useState(!state?.analysis);
  const [enriching, setEnriching] = useState(false);
  const [modal, setModal] = useState(null); // null | 'slides' | 'metrics'

  // AI로 완성하기 — 깊은 분석을 돌린 뒤, 같은 문서 페이지에서 더 풍부해진 내용을 보여준다.
  const handleComplete = async () => {
    if (enriching) return;
    setEnriching(true);
    try {
      const data = await analyzeExperience(id);
      setExp(prev => ({ ...(prev || {}), structuredResult: data, keywords: data.keywords || prev?.keywords || [] }));
      toast.success('AI로 완성됐어요. 더 풍부해진 내용을 확인해보세요.');
    } catch (err) {
      toast.error(err?.message || 'AI 완성에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setEnriching(false);
    }
  };

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
  const isDraftResult = !!sr._draft;

  // ── 모달용 데이터: 슬라이드 덱 / 시장 지표 ──
  const slides = Object.entries(sr.sectionSlides || {})
    .map(([key, s]) => ({
      key,
      kicker: clean(s?.kicker) || key,
      headline: clean(s?.headline),
      subcopy: clean(s?.subcopy),
      cards: (Array.isArray(s?.evidenceCards) ? s.evidenceCards : [])
        .map(c => ({ label: clean(c?.label), title: clean(c?.title), body: clean(c?.body), metric: clean(c?.metric) }))
        .filter(c => c.title || c.body || c.metric),
    }))
    .filter(s => s.headline || s.subcopy || s.cards.length > 0);
  const marketMetrics = (Array.isArray(sr.marketResearch?.decisionMetrics) ? sr.marketResearch.decisionMetrics : [])
    .map(m => ({
      metric: clean(m?.metric),
      whyItMatters: clean(m?.whyItMatters),
      recommendedProxy: clean(m?.recommendedProxy),
      researchBasis: clean(m?.researchBasis),
      confidence: clean(m?.confidence),
    }))
    .filter(m => m.metric);
  const marketOverview = clean(sr.marketResearch?.marketOverview);

  // ── 노션 포트폴리오로 내보내기 ──
  // 동일한 exportConfig를 만들어 /app/portfolio 로 보내면,
  // PortfolioHub에서 포트폴리오를 고르거나 새로 만들어 NotionPortfolioEditor가 경험을 자동 추가한다.
  const handleExportToPortfolio = () => {
    const textBlock = (content) => ({ id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'text', content: content || '' });
    const metaLines = [
      clean(ov.duration) && `기간: ${clean(ov.duration)}`,
      clean(ov.role) && `역할: ${clean(ov.role)}`,
      clean(ov.team) && `팀 구성: ${clean(ov.team)}`,
      clean(ov.scopeOfImpact) && `영향 범위: ${clean(ov.scopeOfImpact)}`,
      techStack.length > 0 && `기술: ${techStack.join(', ')}`,
      clean(ov.goal) && `목표: ${clean(ov.goal)}`,
    ].filter(Boolean).join('\n');
    const keyExperienceText = rawKeyExps.map((item, i) => [
      `${i + 1}. ${clean(item.title) || '핵심 경험'}`,
      (clean(item.metric) || clean(item.afterMetric)) ? `성과: ${clean(item.afterMetric) || clean(item.metric)}` : '',
      clean(item.context || item.situation) ? `상황: ${clean(item.context || item.situation)}` : '',
      clean(item.action) ? `행동: ${clean(item.action)}` : '',
      clean(item.result) ? `결과: ${clean(item.result)}` : '',
      clean(item.learning) ? `학습: ${clean(item.learning)}` : '',
    ].filter(Boolean).join('\n')).join('\n\n');

    const rawSections = [];
    if (metaLines.trim()) rawSections.push({ key: 'project-meta', label: '프로젝트 정보', type: 'meta', content: metaLines });
    if (keyExperienceText.trim()) rawSections.push({ key: 'key-experiences', label: '핵심 경험 & 성과', type: 'summary', content: keyExperienceText });
    EXPORT_SECTION_ORDER.forEach(k => {
      const c = clean(sr[k]);
      if (c) rawSections.push({ key: k, label: EXPORT_SECTION_LABELS[k], type: 'base', content: c });
    });
    const sections = rawSections.map(s => ({ ...s, blocks: s.content ? [textBlock(s.content)] : [] }));

    if (sections.length === 0) {
      toast.error('내보낼 내용이 아직 없어요. 먼저 AI로 완성해 주세요.');
      return;
    }

    const exportConfig = {
      experienceId: id,
      title,
      jobCategory: sr.jobCategory || 'common',
      sectionOrder: sections.map(s => s.key),
      sections,
      structuredResult: sr,
      keywords: sr.keywords || exp?.keywords || [],
      keyExperiences: rawKeyExps,
      projectOverview: ov,
      marketResearch: sr.marketResearch || {},
      coverImg: sr.exportConfig?.coverImg || null,
    };
    navigate('/app/portfolio', { state: { exportConfig } });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 상단 액션 바 */}
      <div className="max-w-3xl mx-auto px-5 sm:px-8 pt-6 flex items-center justify-between text-[13px]">
        <Link to="/app/experience" className="font-medium text-bluewood-400 hover:text-bluewood-700 transition-colors">← 경험 목록</Link>
        <button onClick={handleExportToPortfolio} className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">포트폴리오로 내보내기 →</button>
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

          {/* ── 초안 → AI 완성 (핵심 액션) ── */}
          {isDraftResult && (
            <div className="mt-7 flex flex-wrap items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50/50 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold text-bluewood-700">이건 빠른 초안이에요</p>
                <p className="text-[12.5px] text-bluewood-500 mt-0.5" style={{ wordBreak: 'keep-all' }}>AI로 완성하면 시장 근거·핵심 경험·성과 지표까지 채워 더 풍부해져요.</p>
              </div>
              <button
                onClick={handleComplete}
                disabled={enriching}
                className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-600 text-white text-[14px] font-bold hover:bg-primary-700 disabled:opacity-60 transition-colors shadow-sm shadow-primary-600/20"
              >
                {enriching && <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {enriching ? 'AI가 완성하는 중…' : '✨ AI로 완성하기'}
              </button>
            </div>
          )}

          {/* ── 더 보기: 슬라이드 덱 / 시장 지표 (모달) ── */}
          {(slides.length > 0 || marketMetrics.length > 0 || marketOverview) && (
            <div className="mt-6 flex flex-wrap gap-2">
              {slides.length > 0 && (
                <button
                  onClick={() => setModal('slides')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-bluewood-700 hover:border-primary-300 hover:text-primary-600 transition-colors"
                >
                  슬라이드 덱 보기 <span className="text-bluewood-300">{slides.length}</span>
                </button>
              )}
              {(marketMetrics.length > 0 || marketOverview) && (
                <button
                  onClick={() => setModal('metrics')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-bluewood-700 hover:border-primary-300 hover:text-primary-600 transition-colors"
                >
                  시장·지표 근거 보기 {marketMetrics.length > 0 && <span className="text-bluewood-300">{marketMetrics.length}</span>}
                </button>
              )}
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
            {isDraftResult && (
              <button
                onClick={handleComplete}
                disabled={enriching}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-600 text-white text-[14px] font-bold hover:bg-primary-700 disabled:opacity-60 transition-colors shadow-sm shadow-primary-600/20"
              >
                {enriching && <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {enriching ? 'AI가 완성하는 중…' : '✨ AI로 완성하기'}
              </button>
            )}
            <button
              onClick={handleExportToPortfolio}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold transition-colors ${isDraftResult ? 'bg-white border border-surface-200 text-bluewood-700 hover:bg-surface-50' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm shadow-primary-600/20'}`}
            >
              📤 포트폴리오로 내보내기
            </button>
            <Link to={`/app/experience/structured/${id}`} className="px-5 py-3 rounded-xl bg-white border border-surface-200 text-bluewood-700 text-[14px] font-bold hover:bg-surface-50 transition-colors">
              고급 편집
            </Link>
            <Link to="/app/experience" className="px-5 py-3 rounded-xl bg-white border border-surface-200 text-bluewood-700 text-[14px] font-bold hover:bg-surface-50 transition-colors">
              경험 목록으로
            </Link>
          </div>
        </article>
      )}

      {/* ── 모달: 슬라이드 덱 / 시장·지표 근거 ── */}
      {modal && (
        <div className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8" onClick={() => setModal(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-surface-200 px-6 py-4">
              <h2 className="text-[16px] font-extrabold text-bluewood-900">
                {modal === 'slides' ? '슬라이드 덱' : '시장·지표 근거'}
              </h2>
              <button onClick={() => setModal(null)} className="text-bluewood-300 hover:text-bluewood-600 text-[22px] leading-none">×</button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto px-6 py-5 space-y-4">
              {modal === 'slides' && slides.map((s, i) => (
                <div key={s.key} className="rounded-xl border border-surface-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] mb-1.5" style={{ color: ACCENT }}>{i + 1}. {s.kicker}</p>
                  {s.headline && <p className="text-[16px] font-extrabold text-bluewood-900 leading-snug" style={{ wordBreak: 'keep-all' }}>{s.headline}</p>}
                  {s.subcopy && <p className="mt-1.5 text-[13px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{s.subcopy}</p>}
                  {s.cards.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {s.cards.map((c, ci) => (
                        <div key={ci} className="rounded-lg bg-surface-50 border border-surface-100 px-3 py-2.5">
                          {c.label && <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-bluewood-300">{c.label}</p>}
                          {c.title && <p className="mt-0.5 text-[12.5px] font-bold text-bluewood-800 leading-snug" style={{ wordBreak: 'keep-all' }}>{c.title}</p>}
                          {c.body && <p className="mt-1 text-[11.5px] leading-[1.55] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{c.body}</p>}
                          {c.metric && <p className="mt-1 text-[12px] font-black" style={{ color: ACCENT }}>{c.metric}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {modal === 'metrics' && (
                <>
                  {marketOverview && (
                    <p className="text-[13.5px] leading-[1.75] text-bluewood-600 rounded-xl bg-surface-50 border border-surface-100 px-4 py-3" style={{ wordBreak: 'keep-all' }}>{marketOverview}</p>
                  )}
                  {marketMetrics.map((m, i) => (
                    <div key={i} className="rounded-xl border border-surface-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[14.5px] font-extrabold text-bluewood-900">{m.metric}</p>
                        {m.confidence && <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-surface-100 text-[10.5px] font-bold text-bluewood-400 uppercase">{m.confidence}</span>}
                      </div>
                      {m.whyItMatters && <p className="mt-1.5 text-[12.5px] leading-[1.6] text-bluewood-600" style={{ wordBreak: 'keep-all' }}>{m.whyItMatters}</p>}
                      {m.recommendedProxy && <p className="mt-1.5 text-[12px] text-bluewood-500"><span className="font-bold text-bluewood-400">측정법 </span>{m.recommendedProxy}</p>}
                      {m.researchBasis && <p className="mt-1 text-[12px] text-bluewood-400" style={{ wordBreak: 'keep-all' }}>근거: {m.researchBasis}</p>}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
