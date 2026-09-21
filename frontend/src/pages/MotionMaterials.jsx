import { useId } from 'react';

// These are the actual materials in the 15-second shot, with their original texture,
// lighting and irregular edges. SVG clips keep the source image intact.
const MATERIALS = {
  paper: { box: [1077, 519, 219, 90], path: 'M1085 527L1174 522L1210 526L1286 523L1284 530L1289 534L1283 542L1290 547L1286 555L1292 559L1286 567L1290 573L1284 580L1290 585L1286 594L1291 600L1200 607L1084 602L1089 595L1082 588L1088 580L1082 574L1087 566L1081 559L1086 551L1081 544L1086 537Z' },
  binder: { box: [1083, 600, 237, 41], path: 'M1094 602L1202 607L1312 602L1317 608L1310 613L1309 630L1317 632L1317 638L1200 641L1093 635L1088 630L1091 611L1086 608Z' },
};

export function DeskMaterial({ kind = 'paper', width = 216, height, x = 0, y = 0 }) {
  const id = useId().replace(/:/g, '');
  const material = MATERIALS[kind];
  const [sx, sy, sw, sh] = material.box;
  const h = height ?? sh * width / sw;
  return <svg x={x - width / 2} y={y - h} width={width} height={h} viewBox={`${sx} ${sy} ${sw} ${sh}`} preserveAspectRatio="none" overflow="visible">
    <defs><clipPath id={`material-${id}`}><path d={material.path} /></clipPath></defs>
    <image href="/motion/graduate-wide.png" width="1672" height="941" clipPath={`url(#material-${id})`} />
  </svg>;
}

const smooth = n => { const p = Math.max(0, Math.min(1, n)); return p * p * p * (10 + p * (-15 + 6 * p)); };
const ITEMS = ['binder', 'paper', 'paper', 'binder', 'paper', 'paper', 'binder', 'paper', 'paper'];

export function PaperStack({ x, y, width, start, gap, time, flip = false }) {
  let top = 0;
  return <g transform={`translate(${x} ${y})`} data-paper-stack="true">
    <ellipse cy="2" rx={width * .51} ry="10" fill="#71617f" opacity={.22 * smooth((time - start) / .8)} filter="url(#clay-blur)" />
    {ITEMS.map((kind, i) => {
      const h = kind === 'binder' ? 29 : 27 + i % 3 * 5;
      const finalY = -top;
      top += h - 3;
      const elapsed = time - start - i * gap;
      if (elapsed <= 0) return null;
      const p = smooth(elapsed / 1.05);
      // Fixed thickness: each object approaches, decelerates, then settles on contact.
      const settle = elapsed > 1.05 && elapsed < 1.55 ? Math.sin((elapsed - 1.05) / .5 * Math.PI) * 1.2 : 0;
      const drift = (flip ? -1 : 1) * (1 - p) * (18 + i % 3 * 6);
      const angle = (1 - p) * (i % 2 ? -5 : 5);
      return <g key={i} opacity={smooth(elapsed / .28)} transform={`translate(${drift + (i % 3 - 1) * 3} ${finalY - (1 - p) * 76 + settle}) rotate(${angle})`}>
        <DeskMaterial kind={kind} width={width + (i % 3 - 1) * 5} height={h} />
      </g>;
    })}
  </g>;
}
