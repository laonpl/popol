// 유닛 분류·아이템 배정 점검. Usage: node debug-units.mjs <pptx> <sectionType> <tplIdx>
import fs from 'fs';
import { parsePptxLayout } from './src/services/templateParser.js';
import { planDeck, __mapperInternals as M } from './src/services/geminiMapper.js';

const portfolio = JSON.parse(fs.readFileSync('./debug-portfolio.json', 'utf8'));
const file = process.argv[2] || '../기말 양식.pptx';
const layout = await parsePptxLayout(fs.readFileSync(file));
const { norm, plan } = planDeck(layout, portfolio);

for (const step of plan) {
  if (process.argv[3] && step.sectionType !== process.argv[3]) continue;
  const ctx = M.buildContext(norm, step);
  const { slots, slideW, slideH } = M.buildSlots(layout, step);
  const units = M.buildUnits(slots, slideW, slideH);
  const items = M.buildSectionItems(step, ctx);
  console.log(`\n#### ${step.sectionType}[${step.sectionParam ?? ''}] tpl#${step.templateSlideIndex}`);
  console.log('items:', items.map(i => `{L:${i.label}|H:${(i.heading || '').slice(0, 14)}|B:${(i.body || '').slice(0, 18)}|M:${i.metric}}`).join(' '));
  units.forEach((u, gi) => {
    const d = (s) => `${s.shapeId.replace(/slide\d+_/, '')}(${s.x},${s.y} ${s.width}x${s.height} ${s.basePt}pt cap${s.maxChars})`;
    console.log(` unit${gi}: value=${u.valueSlot ? d(u.valueSlot) : '-'} labels=[${u.labelSlots.map(d)}] bodies=[${u.bodySlots.map(d)}] heads=[${u.headingSlots.map(d)}]`);
  });
  const filled = M.fillByUnits(step, ctx, slots, units, items);
  for (const s of slots) {
    const f = filled.get(s.shapeId);
    if (f?.text) console.log(`  -> ${s.shapeId.replace(/slide\d+_/, '')} [${s.semanticRole}] = "${f.text.slice(0, 60)}"`);
  }
}
