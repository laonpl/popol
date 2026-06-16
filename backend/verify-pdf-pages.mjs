// 생성된 PDF의 페이지 수·텍스트 포함 여부 점검 (+ 가능하면 페이지 이미지 추출)
import fs from 'fs';
import { PDFParse } from 'pdf-parse';

const buf = fs.readFileSync(process.argv[2] || './smoke-portfolio-out.pdf');
const parser = new PDFParse({ data: new Uint8Array(buf) });
console.log('[methods]', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)).join(', '));

const result = await parser.getText();
console.log('[keys]', Object.keys(result).join(', '));
const pages = result.pages || [];
console.log(`[pages] ${result.total ?? pages.length}`);
for (const [i, p] of pages.entries()) {
  const t = (p.text || '').replace(/\s+/g, ' ').trim();
  console.log(`\n── p.${i + 1} (${t.length}자) ──\n${t.slice(0, 220)}`);
}

const MUST = ['김유신', '코코네', '프론트엔드', 'POPOL', '12건', '8시간', '해커톤', '가천대학교', 'TOEIC', '감사합니다'];
const all = result.text || pages.map(p => p.text).join('\n');
const missing = MUST.filter(k => !all.includes(k));
console.log(`\n[check] 누락 키워드: ${missing.length ? missing.join(', ') : '없음 ✓'}`);

try {
  const shots = await parser.getScreenshot({ scale: 1.4 });
  (shots.pages || []).forEach((p, i) => {
    const data = p.data || p.png || p.image;
    if (data) fs.writeFileSync(`./pdf-page-${i + 1}.png`, Buffer.from(data));
  });
  console.log(`[screenshot] ${shots.pages?.length || 0}장 저장`);
} catch (e) {
  console.log('[screenshot] 미지원:', e.message);
}
await parser.destroy();
