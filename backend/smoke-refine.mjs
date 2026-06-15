// mapDeck 전체 경로(결정론 채움 → 카피 리파인 → 피팅 → 렌더) 스모크 테스트.
// Usage: node smoke-refine.mjs [pptx]
import fs from 'fs';
import 'dotenv/config';
import { parsePptxLayout, extractDesignDna } from './src/services/templateParser.js';
import { mapDeck } from './src/services/geminiMapper.js';
import { renderDeckInPlace } from './src/services/pptxRendererInPlace.js';

const portfolio = JSON.parse(fs.readFileSync('./debug-portfolio.json', 'utf8'));
const file = process.argv[2] || '../기말 양식.pptx';
const buf = fs.readFileSync(file);

const layout = await parsePptxLayout(buf);
let designDna = null;
try { designDna = await extractDesignDna(buf); } catch {}
console.log('[smoke] designDna:', designDna && { bg: designDna.bg, accent: designDna.accent });

const t0 = Date.now();
const deck = await mapDeck({ portfolio, layout, designDna });
console.log(`[smoke] mapDeck 완료: ${deck.length}장, ${Date.now() - t0}ms`);

for (const slide of deck.slice(0, 6)) {
  console.log(`\n#### ${slide.sectionType} tpl#${slide.templateSlideIndex}`);
  for (const b of slide.boxes) {
    if ((b.text || '').trim()) console.log(`  [${b.semanticRole}] "${b.text.replace(/\n/g, ' ⏎ ').slice(0, 90)}"`);
  }
}

const out = await renderDeckInPlace(deck, buf);
fs.writeFileSync('./smoke-refine-out.pptx', out);
console.log(`\n[smoke] 렌더 완료 → smoke-refine-out.pptx (${out.length} bytes)`);
