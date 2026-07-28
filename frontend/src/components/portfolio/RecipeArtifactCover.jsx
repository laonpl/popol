/**
 * RecipeArtifactCover — 데이터 주도 히어로 커버.
 *
 * dev/pm/marketer는 손으로 만든 전용 변형(JobArtifactCover의 15종)을 그대로 쓰고,
 * 전용 변형이 없는 나머지 직군은 구성 계획이 만든 레시피(artifactRecipe)에 따라
 * 기존 시각화 프리미티브(JobVisuals)를 조합해 경험마다 다른 히어로를 만든다.
 *
 * 데이터가 없는 블록은 프리미티브가 null을 반환하므로 자동으로 빠진다.
 * 남는 블록이 하나도 없으면 커버 전체를 렌더하지 않는다(빈 상자 방지).
 */
import { KpiTileRow, FunnelChart, DumbbellCompare, MixBar, GoalBoard, GaugeRow, ProcessFlow, tint } from './JobVisuals';

/* 검증된 팔레트 — AI가 임의 색을 만들지 못하게 톤 이름으로만 고르게 한다 */
const TONES = {
  navy: { accent: '#002F6C', bg: '#eef3f9' },
  forest: { accent: '#0a743e', bg: '#eefaf1' },
  ember: { accent: '#c2410c', bg: '#fdf1ea' },
  plum: { accent: '#6d28d9', bg: '#f4f0fd' },
  slate: { accent: '#334155', bg: '#f1f5f9' },
};
const toneOf = (t) => TONES[t] || TONES.navy;

/** 레시피 블록 타입 → 프리미티브 + 데이터 바인딩 */
function renderBlock({ type, title }, visuals, accent) {
  const v = visuals || {};
  switch (type) {
    case 'kpis': return v.kpis?.length ? <KpiTileRow title={title} items={v.kpis} accent={accent} /> : null;
    case 'funnel': return v.funnel?.length >= 2 ? <FunnelChart title={title} stages={v.funnel} accent={accent} /> : null;
    case 'compare': return v.compare?.length ? <DumbbellCompare title={title} rows={v.compare} accent={accent} /> : null;
    case 'mix': return v.mix?.length >= 2 ? <MixBar title={title} items={v.mix} accent={accent} /> : null;
    case 'goals': return v.goals?.length ? <GoalBoard title={title} goals={v.goals} accent={accent} /> : null;
    case 'gauges': return v.gauges?.length ? <GaugeRow title={title} items={v.gauges} accent={accent} /> : null;
    case 'process': return v.steps?.length >= 2 ? <ProcessFlow title={title} steps={v.steps} accent={accent} /> : null;
    default: return null;
  }
}

export default function RecipeArtifactCover({ recipe, visuals }) {
  if (!recipe?.blocks?.length) return null;
  const tone = toneOf(recipe.tone);
  const rendered = recipe.blocks
    .map(block => ({ block, node: renderBlock(block, visuals, tone.accent) }))
    .filter(item => item.node);
  if (rendered.length === 0) return null;

  const main = rendered.filter(r => r.block.span === 'main');
  const side = rendered.filter(r => r.block.span !== 'main');

  return (
    <div className="w-full p-6" style={{ backgroundColor: tone.bg }}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {recipe.kicker && (
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: tone.accent }}>
              {recipe.kicker}
            </p>
          )}
          {recipe.title && <p className="mt-1 text-[21px] font-black text-bluewood-900">{recipe.title}</p>}
        </div>
        {recipe.badge && (
          <span className="flex-shrink-0 rounded-full px-3 py-1 text-[9px] font-black text-white" style={{ backgroundColor: tone.accent }}>
            {recipe.badge}
          </span>
        )}
      </div>

      <div className={`mt-5 grid gap-3 ${side.length > 0 ? 'lg:grid-cols-[1.4fr_1fr]' : ''}`}>
        <div className="min-w-0 space-y-3">
          {main.map(({ block, node }) => <div key={block.type} className="rounded-xl bg-white/70 p-1">{node}</div>)}
        </div>
        {side.length > 0 && (
          <div className="min-w-0 space-y-3">
            {side.map(({ block, node }) => <div key={block.type} className="rounded-xl bg-white/70 p-1">{node}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

export { TONES as ARTIFACT_TONE_PALETTE };
