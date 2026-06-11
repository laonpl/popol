// 기말 양식.pptx 구조 해부 — parsePptxLayout + planDeck 결과 확인 (검증 후 삭제)
import fs from 'node:fs';
import { parsePptxLayout } from './src/services/templateParser.js';

const buf = fs.readFileSync('../기말 양식.pptx');
const layout = await parsePptxLayout(buf);
console.log('slideSize:', layout.slideSize);
console.log('theme:', { ...layout.theme, _schemeMap: undefined });
console.log('slides:', layout.slides.length);
for (const s of layout.slides) {
  console.log(`\n── slide ${s.index} ── bg=${s.bg} textBoxes=${s.textBoxes.length} decor=${s.decor.length} pics=${s.pics.length}`);
  for (const b of s.textBoxes) {
    const txt = (b.originalText || '').replace(/\n/g, ' / ').slice(0, 60);
    console.log(`  [${b.shapeId}] role=${b.role} ph=${b.phType || '-'} ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)} ${b.fontPt}pt "${txt}"`);
  }
}
