import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, Pencil, Target, Users, Clock } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import KeyExperienceSlider from '../../components/KeyExperienceSlider';

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

const SECTION_KEYS = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];

const SECTION_META = {
  intro:      { num: '01', label: '프로젝트 소개', accent: '#3B82F6' },
  overview:   { num: '02', label: '프로젝트 개요', accent: '#3B82F6' },
  task:       { num: '03', label: '진행한 일', accent: '#3B82F6' },
  process:    { num: '04', label: '과정', accent: '#3B82F6' },
  output:     { num: '05', label: '결과물', accent: '#3B82F6' },
  growth:     { num: '06', label: '성장한 점', accent: '#3B82F6' },
  competency: { num: '07', label: '나의 역량', accent: '#3B82F6' },
};

export default function AnalysisResult() {
  const { id } = useParams();
  const { state: navState } = useLocation();
  const [experience, setExperience] = useState(null);
  const [loading, setLoading] = useState(!navState?.analysis);
  const [allImages, setAllImages] = useState([]);
  const [sectionImages, setSectionImages] = useState({});
  const [imageConfig, setImageConfig] = useState({});

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

  /* 프로젝트 개요 메타 항목 */
  const overviewMeta = [
    projectOverview.goal     && { label: '목표',   value: projectOverview.goal },
    projectOverview.role     && { label: '역할',   value: projectOverview.role },
    projectOverview.team     && { label: '팀 구성', value: projectOverview.team },
    projectOverview.duration && { label: '기간',   value: projectOverview.duration },
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

  /* 작성된 섹션 수 */
  const filledCount = SECTION_KEYS.filter(k => displayContent[k]?.trim()).length;

  return (
    <div className="animate-fadeIn max-w-[1200px] mx-auto pb-12">
      {/* 상단 네비 + 편집 버튼 */}
      <div className="flex items-center justify-between mb-5">
        <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-bluewood-400 hover:text-bluewood-600 transition-colors">
          <ArrowLeft size={16} /> 경험 목록으로
        </Link>
        <Link to={`/app/experience/structured/${id}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-card">
          <Pencil size={14} /> 편집하기
        </Link>
      </div>

      {/* ╔══════════════════════════════════════════════╗
         ║  상단 대시보드: 좌 Overview + 우 핵심경험    ║
         ╚══════════════════════════════════════════════╝ */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 mb-5">

        {/* ── 좌: 프로젝트 Overview ── */}
        <div className="bg-white rounded-2xl border border-surface-200 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-extrabold text-bluewood-900">Overview</h2>
            <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center">
              <Target size={14} className="text-bluewood-400" />
            </div>
          </div>

          <h3 className="text-lg font-bold text-bluewood-900 leading-snug mb-2">{title}</h3>
          {(projectOverview.background || projectOverview.summary) && (
            <p className="text-[12.5px] text-bluewood-400 leading-relaxed mb-5">
              {projectOverview.background || projectOverview.summary}
            </p>
          )}

          {overviewMeta.length > 0 && (
            <div className="space-y-3 mb-5">
              {overviewMeta.map((m, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 text-[12px] font-bold text-bluewood-300 mt-px">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-semibold text-bluewood-700">{m.label}</span>
                    <p className="text-[12px] text-bluewood-400 leading-relaxed">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(projectOverview.techStack || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {projectOverview.techStack.map((tech, i) => (
                <span key={i} className="px-2.5 py-1 bg-surface-100 text-bluewood-600 rounded-md text-[11px] font-medium">{tech}</span>
              ))}
            </div>
          )}

          {keywords.length > 0 && (
            <div className="mt-auto pt-4 border-t border-surface-100">
              <div className="flex flex-wrap gap-1.5">
                {keywords.map(k => (
                  <span key={k} className="px-2.5 py-1 bg-primary-50 text-primary-600 rounded-md text-[11px] font-medium border border-primary-100">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 우: 핵심 경험 슬라이더 ── */}
        <div className="min-w-0">
          <KeyExperienceSlider keyExperiences={keyExperiences} />
        </div>
      </div>

      {/* ╔══════════════════════════════════════════════╗
         ║  하단: 상세 경험 정리 — 항상 펼쳐진 표       ║
         ╚══════════════════════════════════════════════╝ */}
      <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <div className="flex items-center gap-3">
            <Sparkles size={16} className="text-primary-600" />
            <h2 className="text-[15px] font-extrabold text-bluewood-900">상세 경험 정리</h2>
            <span className="text-[12px] text-bluewood-300 font-medium">{filledCount}/7 작성</span>
          </div>
        </div>

        {/* 하이라이트 범례 */}
        {highlights.length > 0 && (
          <div className="flex items-center gap-5 px-6 py-2.5 bg-surface-50/60 border-b border-surface-100">
            {Object.entries(highlightColors).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2 text-[11px] text-bluewood-500">
                <span className="inline-block w-5 h-0" style={{ borderBottom: `2.5px solid ${color.underline}` }} />
                {color.label}
              </div>
            ))}
          </div>
        )}

        {/* 섹션 본문 */}
        <div className="divide-y divide-surface-100">
          {SECTION_KEYS.map(sectionKey => {
            const text = displayContent[sectionKey] || '';
            const meta = SECTION_META[sectionKey];
            const fieldHighlights = highlights.filter(h => h.field === sectionKey);
            const isEmpty = !text.trim();

            return (
              <div key={sectionKey}>
                {/* 섹션 헤더 */}
                <div className="flex items-center gap-4 px-6 py-3 bg-surface-50/30">
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ backgroundColor: meta.accent }}>
                    {meta.num}
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: meta.accent }}>{meta.label}</span>
                  {isEmpty && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-[10px] font-semibold">빈칸</span>
                  )}
                </div>

                {/* 섹션 내용 */}
                <div className="px-6 py-4 pl-[60px]">
                  {renderSectionImages(sectionKey, 'above')}

                  {isEmpty ? (
                    <p className="text-[13px] text-bluewood-300 italic">편집 모드에서 내용을 작성해 주세요</p>
                  ) : (
                    <div className="text-[13px] text-bluewood-700 leading-[1.85] whitespace-pre-wrap">
                      <HighlightedText text={text} highlights={fieldHighlights} keywords={keywords} />
                    </div>
                  )}

                  {renderSectionImages(sectionKey, 'below')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
              <span key={k} className="px-1.5 py-0.5 bg-white/20 rounded-md text-[10px] leading-tight">{k}</span>
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
