import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, Pencil, Target, ChevronDown, ChevronUp, TrendingUp, Lightbulb, Zap, Users, CheckCircle2, Star, AlertCircle, Loader2 } from 'lucide-react';
import { doc, getDoc } from '../../services/firestoreProxy';
import { db } from '../../config/firebase';
import KeyExperienceSlider from '../../components/KeyExperienceSlider';
import useExperienceStore from '../../stores/experienceStore';
import toast from 'react-hot-toast';

/* ── 마크다운 **bold** 제거 유틸 ── */
function stripMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/\*\*/g, '').replace(/^#+\s/gm, '').replace(/^[-*]\s/gm, '');
}

// 하이라이트 색상 매핑 (밑줄 스타일)
const highlightColors = {
  core: { underline: '#ef4444', label: '핵심 역량', dot: 'bg-red-400' },
  derived: { underline: '#f59e0b', label: '파생 역량', dot: 'bg-amber-400' },
  growth: { underline: '#22c55e', label: '성장 관점', dot: 'bg-green-400' },
};

const KEYWORD_COLORS = [
  '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b', '#22c55e',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

const SECTION_KEYS = ['intro', 'task', 'process', 'output', 'growth', 'competency'];

// ── 섹션별 고유 색상 코딩 + 아이콘 (Cognitive Load Theory: 색상으로 섹션 구분)
const SECTION_META = {
  intro:      { num: '01', label: '프로젝트 소개',  accent: '#6366f1', bg: '#eef2ff', icon: Star,        desc: '첫인상을 결정하는 임팩트 문장' },
  overview:   { num: '02', label: '프로젝트 개요',  accent: '#0ea5e9', bg: '#f0f9ff', icon: Target,      desc: '배경과 목적' },
  task:       { num: '03', label: '진행한 일',      accent: '#f59e0b', bg: '#fffbeb', icon: Zap,         desc: '배경 → 문제 → 해결' },
  process:    { num: '04', label: '과정',           accent: '#8b5cf6', bg: '#f5f3ff', icon: TrendingUp,  desc: '나의 직접적인 액션 + 의사결정' },
  output:     { num: '05', label: '결과물',         accent: '#10b981', bg: '#ecfdf5', icon: CheckCircle2, desc: '최종 산출물과 성과 수치' },
  growth:     { num: '06', label: '성장한 점',      accent: '#f43f5e', bg: '#fff1f2', icon: Lightbulb,   desc: '역량 변화와 인사이트' },
  competency: { num: '07', label: '나의 역량',      accent: '#0d9488', bg: '#f0fdfa', icon: Users,       desc: '입사 후 기여 가능 포인트' },
};

export default function AnalysisResult() {
  const { id } = useParams();
  const { state: navState } = useLocation();
  const [experience, setExperience] = useState(null);
  const [loading, setLoading] = useState(!navState?.analysis);
  const [allImages, setAllImages] = useState([]);
  const [sectionImages, setSectionImages] = useState({});
  const [imageConfig, setImageConfig] = useState({});
  const [collapsed, setCollapsed] = useState({});
  const [answers, setAnswers] = useState({});
  const [enriching, setEnriching] = useState(false);
  const enrichFromInterview = useExperienceStore(s => s.enrichFromInterview);

  useEffect(() => {
    if (navState?.analysis) {
      setExperience({
        id,
        title: navState.title,
        framework: navState.framework,
        content: navState.content,
        aiAnalysis: navState.analysis,
        keywords: navState.analysis.keywords || navState.analysis.competencyKeywords || [],
      });
      // Load images from Firestore
      (async () => {
        try {
          const docSnap = await getDoc(doc(db, 'experiences', id));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setAllImages(data.images || []);
            setSectionImages(data.sectionImages || {});
            setImageConfig(data.imageConfig || {});
          }
        } catch (err) {
          console.error('이미지 로딩 실패:', err);
        }
      })();
    } else {
      loadExperience();
    }
  }, [id]);

  const loadExperience = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'experiences', id));
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setExperience({
          ...data,
          aiAnalysis: data.structuredResult || {},
          keywords: data.keywords || data.structuredResult?.keywords || [],
        });
        setAllImages(data.images || []);
        setSectionImages(data.sectionImages || {});
        setImageConfig(data.imageConfig || {});
      }
    } catch (error) {
      console.error('경험 로딩 실패:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!experience) {
    return <p className="text-gray-500 text-center py-20">경험 데이터를 찾을 수 없습니다.</p>;
  }

  const { title, aiAnalysis, keywords } = experience;
  const displayContent = aiAnalysis || {};
  const highlights = aiAnalysis?.highlights || [];
  const followUpQuestions = aiAnalysis?.followUpQuestions || [];
  const projectOverview = aiAnalysis?.projectOverview || {};
  const keyExperiences = aiAnalysis?.keyExperiences || [];

  const handleEnrich = async () => {
    const qa = followUpQuestions
      .map((q, i) => ({
        question: typeof q === 'string' ? q : (q.text || q.question || ''),
        answer: (answers[i] || '').trim(),
      }))
      .filter(item => item.answer);
    if (qa.length === 0) return;
    setEnriching(true);
    try {
      const data = await enrichFromInterview(id, qa);
      setExperience(prev => ({ ...prev, aiAnalysis: data, structuredResult: data, keywords: data.keywords || [] }));
      setAnswers({});
      toast.success('답변을 반영해 경험 정리를 보강했어요');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'AI 보강에 실패했어요');
    } finally {
      setEnriching(false);
    }
  };

  /* 프로젝트 개요 메타 항목 */
  const overviewMeta = [
    projectOverview.goal         && { label: '목표',      value: projectOverview.goal },
    projectOverview.role         && { label: '역할',      value: projectOverview.role },
    projectOverview.scopeOfImpact && { label: '영향 범위', value: projectOverview.scopeOfImpact },
    projectOverview.team         && { label: '팀 구성',   value: projectOverview.team },
    projectOverview.duration     && { label: '기간',      value: projectOverview.duration },
  ].filter(Boolean);

  /* 섹션별 이미지 렌더링 */
  const renderSectionImages = (sectionKey, position) => {
    const imgIndices = sectionImages[sectionKey] || [];
    if (imgIndices.length === 0) return null;
    const filtered = imgIndices.filter((imgIdx) => {
      const cfg = imageConfig[`${sectionKey}:${imgIdx}`] || {};
      return (cfg.position || 'below') === position;
    });
    if (filtered.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-3 my-3">
        {filtered.map((imgIdx) => {
          const img = allImages[imgIdx];
          if (!img) return null;
          const cfg = imageConfig[`${sectionKey}:${imgIdx}`] || {};
          const size = cfg.size || 'md';
          const sizeClass = size === 'sm' ? 'max-w-[200px]' : size === 'lg' ? 'max-w-full' : 'max-w-[400px]';
          return (
            <img key={`view-${sectionKey}-${imgIdx}`} src={img.url} alt={img.name || '이미지'}
              className={`${sizeClass} w-auto rounded-xl border border-surface-200 shadow-sm`} />
          );
        })}
      </div>
    );
  };

  /* 작성된 섹션 수 + 완성도 (Gestalt Closure — Progress Ring) */
  const filledCount = SECTION_KEYS.filter(k => displayContent[k]?.trim()).length;
  const completionPct = Math.round((filledCount / SECTION_KEYS.length) * 100);

  /* 섹션 접기/펼치기 토글 */
  const toggleSection = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="animate-fadeIn max-w-[1200px] mx-auto pb-16">

      {/* ── 상단 내비 + 편집 버튼 (Hick's Law: 핵심 CTA 1개) ── */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-bluewood-400 hover:text-bluewood-600 transition-colors">
          <ArrowLeft size={16} /> 경험 목록으로
        </Link>
        <Link to={`/app/experience/structured/${id}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors shadow-md">
          <Pencil size={14} /> 편집하기
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════════
          HERO BAND — 프로젝트 제목 + 완성도 링
          F-Pattern: 사용자 시선이 처음 닿는 좌상단에 핵심 정보
         ══════════════════════════════════════════════════════ */}
      {/* ══ HERO BAND + OVERVIEW 통합 ══ */}
      <div className="relative bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl mb-5 overflow-hidden">
        {/* 배경 장식 */}
        <div className="absolute right-0 top-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/4 pointer-events-none" />
        <div className="absolute right-24 bottom-0 w-40 h-40 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />

        {/* 상단: 제목 + 요약 + 테크스택 + 완성도링 */}
        <div className="relative flex items-start justify-between gap-6 p-7">
          <div className="flex-1 min-w-0">
            {aiAnalysis?.jobCategory && aiAnalysis.jobCategory !== 'common' && (
              <span className="inline-block mb-3 px-3 py-1 bg-white/20 text-white/90 rounded-full text-[12px] font-semibold uppercase tracking-wider">
                {aiAnalysis.jobCategory}
              </span>
            )}
            <h1 className="text-2xl font-extrabold text-white leading-tight mb-2">{title}</h1>
            {projectOverview.summary && (
              <p className="text-white/80 text-[14px] leading-relaxed max-w-2xl">{projectOverview.summary}</p>
            )}
            {(projectOverview.techStack || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {projectOverview.techStack.map((tech, i) => (
                  <span key={i} className="px-2.5 py-1 bg-white/15 text-white/90 rounded-lg text-[12px] font-medium border border-white/20">{tech}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <svg width="72" height="72" viewBox="0 0 72 72" className="drop-shadow-sm">
              <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
              <circle cx="36" cy="36" r="30" fill="none" stroke="white" strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 30}`}
                strokeDashoffset={`${2 * Math.PI * 30 * (1 - completionPct / 100)}`}
                strokeLinecap="round" transform="rotate(-90 36 36)" />
              <text x="36" y="40" textAnchor="middle" fill="white" fontSize="15" fontWeight="800">{completionPct}%</text>
            </svg>
            <span className="text-white/70 text-[12px] font-medium">{filledCount}/6 완성</span>
          </div>
        </div>

        {/* Overview 메타 통합 — 목표/역할/영향범위/팀/기간 */}
        {overviewMeta.length > 0 && (
          <div className="relative border-t border-white/10 px-7 py-4 flex items-stretch divide-x divide-white/10">
            {overviewMeta.map((m, i) => (
              <div key={i} className={`flex flex-col gap-0.5 ${i === 0 ? 'pr-7' : 'px-7'} min-w-0`}>
                <span className="text-[10.5px] font-black text-white/40 uppercase tracking-[0.2em] whitespace-nowrap">{m.label}</span>
                <span className="text-[13px] text-white font-bold leading-snug">{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          키워드 + 핵심경험 (전체 너비)
         ══════════════════════════════════════════════════════ */}

      {/* 키워드 패널 — 슬림 가로형 */}
      {keywords.length > 0 && (
        <div className="px-1 mb-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Sparkles size={13} className="text-primary-500" />
            <span className="text-[12px] font-black text-bluewood-500 uppercase tracking-[0.12em]">역량 키워드</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k, i) => (
              <span key={k} className="px-2.5 py-1 rounded-lg text-[12px] font-semibold border"
                style={{
                  color: KEYWORD_COLORS[i % KEYWORD_COLORS.length],
                  backgroundColor: `${KEYWORD_COLORS[i % KEYWORD_COLORS.length]}15`,
                  borderColor: `${KEYWORD_COLORS[i % KEYWORD_COLORS.length]}30`,
                }}>
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 핵심 경험 — 전체 너비 (ReadOnlyKeyExperiences) */}
      <div className="mb-5">
        <KeyExperienceSlider keyExperiences={keyExperiences} />
      </div>

      {/* ══════════════════════════════════════════════════════
          하이라이트 배너 (있을 때만 노출 — Progressive Disclosure)
         ══════════════════════════════════════════════════════ */}
      {highlights.filter(h => !h.field).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-amber-500" />
            <span className="text-[13px] font-bold text-amber-700">AI 추천 하이라이트</span>
          </div>
          <ul className="space-y-1.5">
            {highlights.filter(h => !h.field).map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-amber-800">
                <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
                {typeof h === 'string' ? h : (h.text || '')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          상세 경험 섹션 — 섹션별 색상 코딩 카드
          Cognitive Load Theory: 색상+아이콘으로 섹션 구분
          Progressive Disclosure: 클릭으로 접기/펼치기
         ══════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        {SECTION_KEYS.map((sectionKey) => {
          const text = displayContent[sectionKey] || '';
          const meta = SECTION_META[sectionKey];
          const SectionIcon = meta.icon;
          const fieldHighlights = highlights.filter(h => h.field === sectionKey);
          const isEmpty = !text.trim();
          const isCollapsed = collapsed[sectionKey];

          return (
            <div key={sectionKey}
              className="rounded-2xl border overflow-hidden transition-all"
              style={{ borderColor: isEmpty ? '#e8ecf0' : `${meta.accent}25` }}>

              {/* 섹션 헤더 — 클릭 가능 (Progressive Disclosure) */}
              <button
                onClick={() => !isEmpty && toggleSection(sectionKey)}
                className="w-full flex items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-surface-50/50"
                style={{ cursor: isEmpty ? 'default' : 'pointer' }}>

                {/* 색상 아이콘 배지 */}
                <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: meta.accent }}>
                  <SectionIcon size={15} color="white" />
                </div>

                {/* 번호 + 라벨 + 설명 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11.5px] font-black tabular-nums tracking-[0.15em] uppercase" style={{ color: meta.accent }}>
                      {meta.num}
                    </span>
                    <span className="text-[16px] font-extrabold text-bluewood-900 leading-tight">{meta.label}</span>
                  </div>
                  {!isEmpty && (
                    <span className="mt-0.5 block text-[12px] text-bluewood-400 font-normal leading-none">{meta.desc}</span>
                  )}
                </div>

                {/* 상태 배지 + 토글 */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isEmpty ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-[12px] font-semibold">
                      <AlertCircle size={10} /> 미작성
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-semibold"
                        style={{ backgroundColor: `${meta.accent}15`, color: meta.accent }}>
                        <CheckCircle2 size={10} /> 작성됨
                      </span>
                      {isCollapsed
                        ? <ChevronDown size={16} className="text-bluewood-300" />
                        : <ChevronUp size={16} className="text-bluewood-300" />}
                    </>
                  )}
                </div>
              </button>

              {/* 섹션 내용 (접기/펼치기) */}
              {!isCollapsed && (
                <div className="px-6 pb-6 pt-1">
                  {/* 섹션 상단 구분선에 accent 색상 적용 */}
                  <div className="h-px mb-4 rounded-full" style={{ backgroundColor: `${meta.accent}20` }} />

                  {renderSectionImages(sectionKey, 'above')}

                  {isEmpty ? (
                    <div className="flex items-center gap-2 py-3">
                      <p className="text-[14px] text-bluewood-300 italic">편집 모드에서 내용을 작성해 주세요</p>
                      <Link to={`/app/experience/structured/${id}`}
                        className="text-[12px] text-primary-500 hover:text-primary-700 font-medium underline underline-offset-2">
                        지금 편집하기
                      </Link>
                    </div>
                  ) : (
                    <div className="text-[15px] text-bluewood-700 leading-[1.9] whitespace-pre-wrap">
                      <HighlightedText text={text} highlights={fieldHighlights} keywords={keywords} />
                    </div>
                  )}

                  {renderSectionImages(sectionKey, 'below')}

                  {/* 섹션별 하이라이트 (있을 때만) */}
                  {fieldHighlights.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-surface-100 flex flex-wrap gap-1.5">
                      {Object.entries(highlightColors).map(([key, color]) => {
                        const hasThis = fieldHighlights.some(h => h.type === key);
                        if (!hasThis) return null;
                        return (
                          <span key={key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] bg-surface-50 border border-surface-200">
                            <span className="inline-block w-3 h-0" style={{ borderBottom: `2px solid ${color.underline}` }} />
                            <span className="text-bluewood-500 font-medium">{color.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════
          AI 심화 인터뷰 — 답변을 되먹여 경험 정리를 보강 (추출형)
         ══════════════════════════════════════════════════════ */}
      {followUpQuestions.length > 0 && (
        <div className="mt-5 pt-5 border-t border-surface-100">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb size={14} className="text-primary-500" />
            <span className="text-[13px] font-bold text-bluewood-700">AI 심화 인터뷰 — 답할수록 정교해집니다</span>
          </div>
          <p className="text-[12px] text-bluewood-400 mb-3">채용 담당자가 가장 궁금해하는, 당신만 답할 수 있는 정보예요. 답변은 그대로 경험 정리에 반영됩니다.</p>
          <div className="space-y-3">
            {followUpQuestions.map((q, i) => {
              const label = typeof q === 'string' ? q : (q.text || q.question || '');
              return (
                <div key={i} className="rounded-xl border border-surface-200 bg-surface-50/50 p-3.5">
                  <div className="flex items-start gap-2.5 mb-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-[12px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <p className="text-[13px] font-medium text-bluewood-700 leading-relaxed">{label}</p>
                  </div>
                  <textarea
                    value={answers[i] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                    placeholder="여기에 답하면 AI가 반영해 보강합니다 (수치·본인 기여·이유를 구체적으로)"
                    rows={2}
                    className="w-full resize-y rounded-lg border border-surface-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200 placeholder:text-bluewood-300"
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleEnrich}
              disabled={enriching || Object.values(answers).every(v => !v?.trim())}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-[14px] font-semibold hover:bg-primary-700 disabled:opacity-50 transition-all shadow-sm">
              {enriching ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {enriching ? 'AI가 보강하는 중...' : '답변으로 경험 정리 보강하기'}
            </button>
            <span className="text-[12px] text-bluewood-400">답한 항목만 반영돼요</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          하단 편집 CTA (Fixed bottom — always visible)
         ══════════════════════════════════════════════════════ */}
      {filledCount < SECTION_KEYS.length && (
        <div className="mt-6 flex justify-center">
          <Link to={`/app/experience/structured/${id}`}
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-2xl text-[15px] font-semibold hover:bg-primary-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
            <Pencil size={16} />
            미작성 섹션 완성하기
            <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-[12px]">{SECTION_KEYS.length - filledCount}개 남음</span>
          </Link>
        </div>
      )}
    </div>
  );
}

// 공백 정규화 후 위치 찾기 (Gemini가 공백/줄바꿈을 약간 바꿔 반환할 수 있음)
function fuzzyIndexOf(text, needle) {
  // 1) 정확한 매칭 먼저 시도
  const exact = text.indexOf(needle);
  if (exact >= 0) return { pos: exact, len: needle.length };

  // 2) 공백 정규화 후 매칭
  const normalize = s => s.replace(/\s+/g, ' ').trim();
  const normText = normalize(text);
  const normNeedle = normalize(needle);
  if (!normNeedle) return null;

  const normPos = normText.indexOf(normNeedle);
  if (normPos < 0) {
    // 3) 부분 문자열 매칭 (needle이 길 경우 앞부분으로 시도)
    const shorter = normNeedle.length > 15 ? normNeedle.slice(0, Math.floor(normNeedle.length * 0.7)) : null;
    if (shorter) {
      const partialPos = normText.indexOf(shorter);
      if (partialPos >= 0) {
        // 정규화된 위치를 원본 위치로 변환
        let origPos = 0, normIdx = 0;
        while (normIdx < partialPos && origPos < text.length) {
          if (/\s/.test(text[origPos])) {
            while (origPos < text.length && /\s/.test(text[origPos])) origPos++;
            normIdx++; // 정규화된 공백 1개
          } else {
            origPos++;
            normIdx++;
          }
        }
        // 원본에서 끝 위치 계산
        let endNormIdx = normIdx;
        let endOrigPos = origPos;
        const targetNormLen = normNeedle.length;
        while (endNormIdx < partialPos + targetNormLen && endOrigPos < text.length) {
          if (/\s/.test(text[endOrigPos])) {
            while (endOrigPos < text.length && /\s/.test(text[endOrigPos])) endOrigPos++;
            endNormIdx++;
          } else {
            endOrigPos++;
            endNormIdx++;
          }
        }
        return { pos: origPos, len: endOrigPos - origPos };
      }
    }
    return null;
  }

  // 정규화 위치 -> 원본 위치 변환
  let origPos = 0, normIdx = 0;
  while (normIdx < normPos && origPos < text.length) {
    if (/\s/.test(text[origPos])) {
      while (origPos < text.length && /\s/.test(text[origPos])) origPos++;
      normIdx++;
    } else {
      origPos++;
      normIdx++;
    }
  }
  let endOrigPos = origPos, endNormIdx = normIdx;
  while (endNormIdx < normPos + normNeedle.length && endOrigPos < text.length) {
    if (/\s/.test(text[endOrigPos])) {
      while (endOrigPos < text.length && /\s/.test(text[endOrigPos])) endOrigPos++;
      endNormIdx++;
    } else {
      endOrigPos++;
      endNormIdx++;
    }
  }
  return { pos: origPos, len: endOrigPos - origPos };
}

// 하이라이트 스팬 + 호버 툴팁 (밑줄 스타일)
function HighlightSpan({ text, type, keywords }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  const color = highlightColors[type] || highlightColors.core;

  return (
    <span
      ref={ref}
      className="relative inline"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span
        className="cursor-help font-medium transition-colors"
        style={{
          borderBottom: `2.5px solid ${color.underline}`,
          paddingBottom: '1px',
          backgroundColor: `${color.underline}10`,
        }}
      >{text}</span>
      {visible && keywords.length > 0 && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl pointer-events-none flex flex-col gap-1.5 min-w-max">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
            {color.label}
          </span>
          <span className="flex flex-wrap gap-1">
            {keywords.map(k => (
              <span key={k} className="px-1.5 py-0.5 bg-white/20 rounded-md text-[12px] leading-tight">{k}</span>
            ))}
          </span>
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

// 텍스트 하이라이팅 + 키워드 밑줄 컴포넌트
function HighlightedText({ text, highlights, keywords = [] }) {
  if (!text) return <p></p>;
  const cleanText = stripMarkdown(text);

  /* 1단계: 구조화 하이라이트 */
  const positioned = (highlights || [])
    .map(h => {
      const needle = stripMarkdown(h.text?.trim() ?? '');
      if (!needle) return null;
      if (h.start != null) return { ...h, pos: h.start, len: needle.length };
      const match = fuzzyIndexOf(cleanText, needle);
      if (!match) return null;
      return { ...h, pos: match.pos, len: match.len };
    })
    .filter(Boolean)
    .sort((a, b) => a.pos - b.pos);

  /* 2단계: 키워드 → 색상 맵 */
  const kwMap = new Map();
  if (keywords.length > 0) {
    keywords.forEach((kw, i) => {
      kwMap.set(kw.toLowerCase(), KEYWORD_COLORS[i % KEYWORD_COLORS.length]);
    });
  }

  let parts = [];
  if (positioned.length > 0) {
    let lastIndex = 0;
    for (const h of positioned) {
      if (h.pos < lastIndex) continue;
      if (h.pos > lastIndex) parts.push({ text: cleanText.slice(lastIndex, h.pos), type: null, keywords: [] });
      parts.push({ text: cleanText.slice(h.pos, h.pos + h.len), type: h.type || 'core', keywords: h.keywords || [] });
      lastIndex = h.pos + h.len;
    }
    if (lastIndex < cleanText.length) parts.push({ text: cleanText.slice(lastIndex), type: null, keywords: [] });
  } else {
    parts = [{ text: cleanText, type: null, keywords: [] }];
  }

  const applyKeywordUnderlines = (str) => {
    if (kwMap.size === 0) return str;
    const sortedKws = [...kwMap.keys()].sort((a, b) => b.length - a.length);
    const escaped = sortedKws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const segments = str.split(regex);
    if (segments.length <= 1) return str;
    return segments.map((seg, i) => {
      const color = kwMap.get(seg.toLowerCase());
      if (color) {
        return (
          <span key={i} className="font-semibold"
            style={{ borderBottom: `2px solid ${color}`, paddingBottom: '0.5px' }}>
            {seg}
          </span>
        );
      }
      return seg;
    });
  };

  return (
    <p>
      {parts.map((part, i) =>
        part.type ? (
          <HighlightSpan key={i} text={part.text} type={part.type} keywords={part.keywords} />
        ) : (
          <span key={i}>{applyKeywordUnderlines(part.text)}</span>
        )
      )}
    </p>
  );
}
