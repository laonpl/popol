/**
 * ThemedPortfolioBlocks.jsx
 * popoldesign.md 10가지 테마 포트폴리오의 visual_sections 렌더러.
 * 각 section.type 에 맞는 시각적 컴포넌트를 렌더링한다.
 */
import { ArrowRight, TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, RotateCcw, ExternalLink } from 'lucide-react';

// ── 방향 아이콘 ──
function DirectionIcon({ direction }) {
  if (direction === 'up') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (direction === 'down') return <TrendingDown className="w-4 h-4 text-rose-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

// ── Hero 섹션 ──
function HeroBlock({ section }) {
  return (
    <div className="relative bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-2xl px-10 py-14 mb-8">
      <div className="mb-4 flex flex-wrap gap-2">
        {(section.tags || []).map((tag, i) => (
          <span key={i} className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20 font-medium">
            {tag}
          </span>
        ))}
      </div>
      <h1 className="text-4xl font-bold mb-1">{section.name}</h1>
      <p className="text-lg text-slate-300 mb-4">{section.role}</p>
      {section.tagline && (
        <p className="text-xl font-medium text-indigo-300 mb-6">"{section.tagline}"</p>
      )}
      {section.impact_summary && (
        <p className="text-slate-300 max-w-2xl leading-relaxed">{section.impact_summary}</p>
      )}
    </div>
  );
}

// ── 메트릭 카드 ──
function MetricCardsBlock({ section }) {
  return (
    <div className="mb-8">
      {section.heading && <h2 className="text-xl font-bold text-slate-800 mb-4">{section.heading}</h2>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(section.cards || []).map((card, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500 font-medium">{card.label}</span>
              <DirectionIcon direction={card.direction} />
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{card.value}</div>
            {card.before && card.after && (
              <div className="flex items-center gap-1 text-sm text-slate-500 mb-2">
                <span className="line-through">{card.before}</span>
                <ArrowRight className="w-3 h-3" />
                <span className="font-semibold text-emerald-600">{card.after}</span>
              </div>
            )}
            {card.context && <p className="text-xs text-slate-400 leading-relaxed">{card.context}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── STAR 블록 ──
function StarBlock({ section }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-slate-800">{section.heading}</h3>
        <div className="flex flex-wrap gap-1">
          {(section.tech_stack || []).map((tech, i) => (
            <span key={i} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full">
              {tech}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {section.problem && (
          <div className="bg-rose-50 border-l-4 border-rose-400 rounded-r-lg p-3">
            <p className="text-xs font-bold text-rose-600 mb-1">S · Situation / 문제</p>
            <p className="text-sm text-rose-800">{section.problem}</p>
          </div>
        )}
        {section.action && (
          <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-3">
            <p className="text-xs font-bold text-blue-600 mb-1">A · Action / 행동</p>
            <p className="text-sm text-blue-800">{section.action}</p>
          </div>
        )}
      </div>

      {section.result && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg p-3 mb-4">
          <p className="text-xs font-bold text-emerald-600 mb-1">R · Result / 결과</p>
          <p className="text-sm text-emerald-800">{section.result}</p>
        </div>
      )}

      {(section.metrics || []).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {section.metrics.map((m, i) => (
            <span key={i} className="text-sm font-bold px-3 py-1 bg-slate-900 text-white rounded-full">
              {m}
            </span>
          ))}
        </div>
      )}

      {section.learning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-bold text-amber-700 mb-1">L · Learning / 배운 점</p>
          <p className="text-sm text-amber-800">{section.learning}</p>
        </div>
      )}
    </div>
  );
}

// ── AARRR 퍼널 ──
const AARRR_COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
function AarrrFunnelBlock({ section }) {
  return (
    <div className="mb-8">
      {section.heading && <h2 className="text-xl font-bold text-slate-800 mb-4">{section.heading}</h2>}
      <div className="space-y-2">
        {(section.funnels || []).map((funnel, i) => {
          const width = Math.max(30, 100 - i * 12);
          return (
            <div key={i} className="flex items-center gap-4">
              <div
                className={`${AARRR_COLORS[i % AARRR_COLORS.length]} text-white rounded-lg px-4 py-3 flex-shrink-0`}
                style={{ width: `${width}%` }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">{funnel.stage}</span>
                  <span className="text-lg font-black">{funnel.value}</span>
                </div>
                <div className="text-xs text-white/80">{funnel.metric}</div>
              </div>
              {funnel.before && funnel.after && (
                <div className="text-sm text-slate-500 flex items-center gap-1 flex-shrink-0">
                  <span>{funnel.before}</span>
                  <ArrowRight className="w-3 h-3" />
                  <span className="font-semibold text-emerald-600">{funnel.after}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Double Diamond 4단계 ──
const DIAMOND_COLORS = [
  { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-800', num: 'bg-violet-500' },
  { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', num: 'bg-blue-500' },
  { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-800', num: 'bg-emerald-500' },
  { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800', num: 'bg-amber-500' },
];
function DiamondStepsBlock({ section }) {
  return (
    <div className="mb-8">
      {section.heading && <h2 className="text-xl font-bold text-slate-800 mb-4">{section.heading}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(section.steps || []).map((step, i) => {
          const c = DIAMOND_COLORS[i % DIAMOND_COLORS.length];
          return (
            <div key={i} className={`${c.bg} border ${c.border} rounded-xl p-4`}>
              <div className={`${c.num} text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center mb-3`}>
                {i + 1}
              </div>
              <p className={`text-xs font-bold ${c.text} mb-1 uppercase tracking-wide`}>{step.step}</p>
              <h4 className={`font-bold ${c.text} mb-2`}>{step.title}</h4>
              <ul className="space-y-1">
                {(step.bullets || []).map((b, j) => (
                  <li key={j} className={`text-xs ${c.text} flex gap-1`}>
                    <span>•</span><span>{b}</span>
                  </li>
                ))}
              </ul>
              {step.outcome && (
                <div className={`mt-3 text-xs font-semibold ${c.text} border-t ${c.border} pt-2`}>
                  → {step.outcome}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Traction 타임라인 ──
const TIMELINE_TYPE_COLOR = { launch: 'bg-indigo-500', milestone: 'bg-emerald-500', pivot: 'bg-amber-500', default: 'bg-slate-400' };
function TractionTimelineBlock({ section }) {
  return (
    <div className="mb-8">
      {section.heading && <h2 className="text-xl font-bold text-slate-800 mb-4">{section.heading}</h2>}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
        <div className="space-y-6">
          {(section.events || []).map((event, i) => {
            const dotColor = TIMELINE_TYPE_COLOR[event.type] || TIMELINE_TYPE_COLOR.default;
            return (
              <div key={i} className="flex gap-4 relative">
                <div className={`w-3 h-3 rounded-full ${dotColor} flex-shrink-0 mt-1.5 ml-3.75 z-10`} style={{ marginLeft: '0.9375rem' }} />
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex-1 shadow-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-slate-800">{event.label}</span>
                    <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{event.date}</span>
                  </div>
                  <p className="text-sm text-slate-600">{event.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 스킬 매트릭스 ──
function SkillMatrixBlock({ section }) {
  return (
    <div className="mb-8">
      {section.heading && <h2 className="text-xl font-bold text-slate-800 mb-4">{section.heading}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(section.groups || []).map((group, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">{group.label}</h4>
            <div className="flex flex-wrap gap-1.5">
              {(group.items || []).map((item, j) => (
                <span key={j} className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 벤토 그리드 ──
const BENTO_SIZE_CLASS = {
  large: 'col-span-2 row-span-2',
  medium: 'col-span-2',
  small: '',
};
function BentoGridBlock({ section }) {
  return (
    <div className="mb-8">
      {section.heading && <h2 className="text-xl font-bold text-slate-800 mb-4">{section.heading}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-fr">
        {(section.cards || []).map((card, i) => {
          const sizeClass = BENTO_SIZE_CLASS[card.size] || '';
          return (
            <div key={i} className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm ${sizeClass}`}>
              <p className="text-xs text-slate-500 font-medium mb-1">{card.title}</p>
              <div className="text-3xl font-black text-slate-900">
                {card.value}
                {card.unit && <span className="text-base font-medium text-slate-500 ml-1">{card.unit}</span>}
              </div>
              {card.description && <p className="text-xs text-slate-400 mt-2 leading-relaxed">{card.description}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 가설 로그 ──
const HYPOTHESIS_STATUS_MAP = {
  success: { icon: <CheckCircle className="w-4 h-4" />, color: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', label: '성공' },
  fail: { icon: <XCircle className="w-4 h-4" />, color: 'bg-rose-50 border-rose-200', badge: 'bg-rose-100 text-rose-700', label: '실패' },
  pivot: { icon: <RotateCcw className="w-4 h-4" />, color: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', label: '피벗' },
};
function HypothesisLogBlock({ section }) {
  return (
    <div className="mb-8">
      {section.heading && <h2 className="text-xl font-bold text-slate-800 mb-4">{section.heading}</h2>}
      <div className="space-y-3">
        {(section.logs || []).map((log, i) => {
          const status = HYPOTHESIS_STATUS_MAP[log.result] || HYPOTHESIS_STATUS_MAP.pivot;
          return (
            <div key={i} className={`border rounded-xl p-4 ${status.color}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-slate-800 text-sm">{log.hypothesis}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 flex items-center gap-1 ${status.badge}`}>
                  {status.icon}{status.label}
                </span>
              </div>
              {log.learning && <p className="text-xs text-slate-600 mb-1"><span className="font-medium">배운 점:</span> {log.learning}</p>}
              {log.pivot_to && <p className="text-xs text-slate-600"><span className="font-medium">피벗 방향:</span> {log.pivot_to}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 텍스트 블록 ──
function TextBlock({ section }) {
  return (
    <div className="mb-8">
      {section.heading && <h2 className="text-xl font-bold text-slate-800 mb-3">{section.heading}</h2>}
      <div className="space-y-3">
        {(section.paragraphs || []).map((p, i) => (
          <p key={i} className="text-slate-700 leading-relaxed">{p}</p>
        ))}
      </div>
    </div>
  );
}

// ── 클로징 ──
function ClosingBlock({ section }) {
  return (
    <div className="bg-slate-900 text-white rounded-2xl px-10 py-10 mt-8 text-center">
      {section.cta_text && <p className="text-xl font-semibold mb-6">{section.cta_text}</p>}
      <div className="flex flex-wrap gap-3 justify-center">
        {(section.links || []).map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm transition-colors"
          >
            {link.label}
            <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ── 섹션 타입별 라우팅 ──
function SectionBlock({ section }) {
  switch (section.type) {
    case 'hero':            return <HeroBlock section={section} />;
    case 'metric_cards':   return <MetricCardsBlock section={section} />;
    case 'star_block':     return <StarBlock section={section} />;
    case 'aarrr_funnel':   return <AarrrFunnelBlock section={section} />;
    case 'diamond_steps':  return <DiamondStepsBlock section={section} />;
    case 'traction_timeline': return <TractionTimelineBlock section={section} />;
    case 'skill_matrix':   return <SkillMatrixBlock section={section} />;
    case 'bento_grid':     return <BentoGridBlock section={section} />;
    case 'hypothesis_log': return <HypothesisLogBlock section={section} />;
    case 'text_block':     return <TextBlock section={section} />;
    case 'closing':        return <ClosingBlock section={section} />;
    default:               return null;
  }
}

/**
 * @param {object} props
 * @param {Array} props.sections  - visual_sections 배열
 * @param {string} [props.themeId] - 테마 ID (향후 테마별 스타일 분기 예정)
 */
export default function ThemedPortfolioBlocks({ sections = [], themeId }) {
  if (!sections.length) return null;
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {sections.map((section, i) => (
        <SectionBlock key={i} section={section} />
      ))}
    </div>
  );
}
