// 템플릿의 모든 <p:pic> 메타 조사: 확장자, 크기, 면적비, 종횡비, 미디어 바이트, 재사용 횟수
import fs from 'fs';
import JSZip from 'jszip';

for (const f of ['../기말 양식.pptx', '../기말과제 최종 - 202135940 김유신.pptx']) {
  const zip = await JSZip.loadAsync(fs.readFileSync(f));
  console.log('==', f);
  const pres = await zip.file('ppt/presentation.xml').async('string');
  const m = pres.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
  const W = +m[1] / 12700, H = +m[2] / 12700;
  const slideNames = Object.keys(zip.files)
    .filter(x => /^ppt\/slides\/slide\d+\.xml$/.test(x))
    .sort((a, b) => +a.match(/slide(\d+)/)[1] - +b.match(/slide(\d+)/)[1]);

  // 1차: 미디어별 사용 횟수 집계
  const usage = new Map(); // mediaPath -> count
  const perSlide = [];
  for (const n of slideNames) {
    const xml = await zip.file(n).async('string');
    const relsFile = n.replace(/(slide\d+\.xml)$/, '_rels/$1.rels');
    const relsTxt = (await zip.file(relsFile)?.async('string')) || '';
    const relMap = {};
    for (const r of relsTxt.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[r[1]] = r[2].replace(/^\.\.\//, 'ppt/');
    const pics = [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map(p => {
      const embed = (p[0].match(/r:embed="([^"]+)"/) || [])[1];
      const media = relMap[embed] || '?';
      usage.set(media, (usage.get(media) || 0) + 1);
      const sz = p[0].match(/<a:ext cx="(\d+)" cy="(\d+)"/);
      const cx = sz ? +sz[1] / 12700 : 0;
      const cy = sz ? +sz[2] / 12700 : 0;
      return { media, cx, cy };
    });
    perSlide.push({ n, pics });
  }
  for (const { n, pics } of perSlide) {
    const descs = [];
    for (const p of pics) {
      const bytes = zip.file(p.media) ? (await zip.file(p.media).async('nodebuffer')).length : 0;
      const areaPct = (p.cx * p.cy) / (W * H) * 100;
      const kb = Math.round(bytes / 1024);
      descs.push(`${p.media.split('/').pop()} ${kb}KB use${usage.get(p.media)} ${areaPct.toFixed(1)}%`);
    }
    console.log(' ', n.replace('ppt/slides/', ''), '→', descs.join(' | ') || '(no pics)');
  }
}
