// PDF → 페이지별 PNG. 사용: node render-pages.mjs lay-magazine.pdf mag
import fs from 'fs';
import { PDFParse } from 'pdf-parse';

const file = process.argv[2];
const prefix = process.argv[3] || 'pg';
const buf = fs.readFileSync(file);
const parser = new PDFParse({ data: new Uint8Array(buf) });
const shots = await parser.getScreenshot({ scale: 1.3 });
(shots.pages || []).forEach((p, i) => {
  const data = p.data || p.png || p.image;
  if (data) fs.writeFileSync(`./${prefix}-p${i + 1}.png`, Buffer.from(data));
});
console.log(`${file}: ${shots.pages?.length || 0} pages → ${prefix}-p*.png`);
await parser.destroy();
