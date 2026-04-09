import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, BookOpen, Pencil } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FRAMEWORKS } from '../../stores/experienceStore';
import KeywordTag from '../../components/KeywordTag';

// 하이라이트 색상 매핑
const highlightColors = {
  core: { bg: 'bg-red-100', border: 'border-red-300', label: '핵심 역량', dot: 'bg-red-400' },
  derived: { bg: 'bg-amber-100', border: 'border-amber-300', label: '파생 역량', dot: 'bg-amber-400' },
  growth: { bg: 'bg-green-100', border: 'border-green-300', label: '성장 관점', dot: 'bg-green-400' },
};

const SECTION_KEYS = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];

const SECTION_META = {
  intro:      { label: '프로젝트 소개' },
  overview:   { label: '프로젝트 개요' },
  task:       { label: '진행한 일' },
  process:    { label: '과정' },
  output:     { label: '결과물' },
  growth:     { label: '성장한 점' },
  competency: { label: '나의 역량' },
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

  // 섹션별 이미지 렌더링 헬퍼
  const renderSectionImages = (sectionKey, position) => {
    const imgIndices = sectionImages[sectionKey] || [];
    if (imgIndices.length === 0) return null;
    const filtered = imgIndices.filter((imgIdx) => {
      const cfg = imageConfig[`${sectionKey}:${imgIdx}`] || {};
      const imgPos = cfg.position || 'below';
      return imgPos === position;
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
            <img
              key={`view-${sectionKey}-${imgIdx}`}
              src={img.url}
              alt={img.name || '이미지'}
              className={`${sizeClass} w-auto rounded-xl border border-surface-200 shadow-sm`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto pb-12">
      <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={16} /> 경험 목록으로
      </Link>

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-gray-400 text-sm">AI가 7가지 핵심으로 정리한 결과를 확인하고 수정하세요.</p>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          {Object.entries(highlightColors).map(([key, color]) => (
            <div key={key} className="flex items-center gap-2 text-sm text-gray-500">
              <span className={`w-3 h-3 rounded-full ${color.dot}`} />
              {color.label}
            </div>
          ))}
        </div>

        {/* Keywords ribbon */}
        {keywords.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {keywords.map(k => (
              <KeywordTag key={k} keyword={k} type="core" />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Article */}
        <div className="col-span-2 space-y-1">
          {SECTION_KEYS.map(sectionKey => {
            const text = displayContent[sectionKey] || '';
            if (!text.trim()) return null;
            const meta = SECTION_META[sectionKey];
            const fieldHighlights = highlights.filter(h => h.field === sectionKey);

            return (
              <div key={sectionKey} className="bg-white rounded-2xl border border-surface-200 p-6 mb-3">
                {/* Section label */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">{meta.label}</span>
                  <span className="text-[10px] text-bluewood-300">|</span>
                  <span className="text-[10px] text-bluewood-300">사진 {(sectionImages[sectionKey] || []).length}장</span>
                </div>

                {/* Images above text */}
                {renderSectionImages(sectionKey, 'above')}

                {/* Text with highlights */}
                <div className="text-sm text-bluewood-700 leading-[1.9] whitespace-pre-wrap">
                  <HighlightedText text={text} highlights={fieldHighlights} />
                </div>

                {/* Images below text */}
                {renderSectionImages(sectionKey, 'below')}
              </div>
            );
          })}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Edit button */}
          <Link
            to={`/app/experience/structured/${id}`}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-card"
          >
            <Pencil size={16} />
            편집으로 돌아가기
          </Link>

          {/* 추출된 역량 키워드 */}
          {(aiAnalysis?.competencyKeywords || keywords || []).length > 0 && (
            <div className="bg-white rounded-2xl border border-surface-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-primary-600" />
                <h3 className="font-bold text-sm text-bluewood-900">추출된 역량 키워드</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {(aiAnalysis?.competencyKeywords || keywords || []).map(k => (
                  <span key={k} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-xl text-xs font-medium border border-primary-200">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 내용 보강 질문 */}
          {followUpQuestions.length > 0 && (
            <div className="bg-white rounded-2xl border border-surface-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={16} className="text-amber-500" />
                <h3 className="font-bold text-sm text-bluewood-900">내용 보강 질문</h3>
              </div>
              <div className="space-y-2">
                {followUpQuestions.map((q, i) => (
                  <div key={i} className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <p className="text-xs text-bluewood-600 leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 추천 자소서 문항 */}
          {(aiAnalysis?.suggestedQuestions || []).length > 0 && (
            <div className="bg-white rounded-2xl border border-surface-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={16} className="text-gray-600" />
                <h3 className="font-bold text-sm text-bluewood-900">추천 자소서 문항</h3>
              </div>
              <div className="space-y-2">
                {aiAnalysis.suggestedQuestions.map((q, i) => (
                  <div key={i} className="p-3 bg-surface-50 rounded-xl">
                    <p className="text-xs text-bluewood-600">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HR Insight */}
          {aiAnalysis?.hrInsight && (
            <div className="bg-green-50 rounded-2xl border border-green-200 p-5">
              <p className="text-xs font-bold text-green-700 mb-2">● HR Insight</p>
              <p className="text-xs text-green-800 leading-relaxed">{aiAnalysis.hrInsight}</p>
            </div>
          )}

          <Link
            to="/app/experience"
            className="block w-full py-3 text-center text-sm border border-surface-200 rounded-xl hover:bg-surface-50 transition-colors text-bluewood-500"
          >
            경험 목록으로
          </Link>
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

// 하이라이트 스팬 + 호버 툴팁
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
      <span className={`highlight-${type} cursor-help`}>{text}</span>
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
          {/* 말풍선 꼬리 */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

// 텍스트 하이라이팅 컴포넌트
function HighlightedText({ text, highlights }) {
  if (!highlights || highlights.length === 0) {
    return <p>{text}</p>;
  }

  const positioned = highlights
    .map(h => {
      const needle = h.text?.trim() ?? '';
      if (!needle) return null;
      if (h.start != null) {
        return { ...h, pos: h.start, len: needle.length };
      }
      const match = fuzzyIndexOf(text, needle);
      if (!match) return null;
      return { ...h, pos: match.pos, len: match.len };
    })
    .filter(Boolean)
    .sort((a, b) => a.pos - b.pos);

  if (positioned.length === 0) {
    return <p>{text}</p>;
  }

  const parts = [];
  let lastIndex = 0;

  for (const h of positioned) {
    if (h.pos < lastIndex) continue;
    if (h.pos > lastIndex) {
      parts.push({ text: text.slice(lastIndex, h.pos), type: null, keywords: [] });
    }
    parts.push({ text: text.slice(h.pos, h.pos + h.len), type: h.type || 'core', keywords: h.keywords || [] });
    lastIndex = h.pos + h.len;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), type: null, keywords: [] });
  }

  return (
    <p>
      {parts.map((part, i) =>
        part.type ? (
          <HighlightSpan key={i} text={part.text} type={part.type} keywords={part.keywords} />
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </p>
  );
}
