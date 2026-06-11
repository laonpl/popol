// 템플릿/출력물의 pic 크기 분석 (검증 후 삭제)
import fs from 'node:fs';
import { parsePptxLayout } from './src/services/templateParser.js';

for (const f of ['../기말 양식.pptx', '../김유신_포트폴리오 (3).pptx']) {
  if (!fs.existsSync(f)) { console.log('없음:', f); continue; }
  const layout = await parsePptxLayout(fs.readFileSync(f));
  const { widthPt: W, heightPt: H } = layout.slideSize;
  console.log(`\n=== ${f} (${W}x${H}) ===`);
  for (const s of layout.slides) {
    const pics = (s.pics || []).map(p => {
      const pct = Math.round((p.w * p.h) / (W * H) * 100);
      return `${Math.round(p.w)}x${Math.round(p.h)}@${Math.round(p.x)},${Math.round(p.y)}(${pct}%)`;
    });
    console.log(`slide${s.index}: pics=${pics.length} [${pics.join(' ')}]`);
  }
}
