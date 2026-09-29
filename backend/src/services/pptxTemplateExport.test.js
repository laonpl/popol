import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { parsePptxLayout } from './templateParser.js';
import { renderDeckInPlace } from './pptxRendererInPlace.js';
import { __mapperInternals } from './geminiMapper.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const artwork = path.resolve(here, '../../../logo.png');
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';

test('custom PPT export follows presentation order and preserves template artwork and master text', async () => {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.defineSlideMaster({
    title: 'BRAND',
    background: { color: 'FFFFFF' },
    objects: [{ text: { text: 'BRAND MARK · PROJECT 01', options: { x: 0.3, y: 0.2, w: 3.5, h: 0.4, fontSize: 14 } } }],
  });
  const first = pptx.addSlide({ masterName: 'BRAND' });
  first.addText('FIRST SOURCE', { x: 0.8, y: 1.2, w: 5, h: 0.8, fontSize: 28 });
  first.addImage({ path: artwork, x: 7, y: 1.2, w: 4, h: 3 });
  first.addTable([['ITEM', 'VALUE'], ['Alpha', '1']], { x: 0.8, y: 4, w: 4, h: 1 });
  first.addText('', { x: 6.5, y: 5, w: 0.6, h: 0.3, line: { color: '3B82F6' } });
  const second = pptx.addSlide({ masterName: 'BRAND' });
  second.addText('SECOND SOURCE', { x: 0.8, y: 1.2, w: 5, h: 0.8, fontSize: 28 });

  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }));
  const presDoc = new DOMParser().parseFromString(await zip.file('ppt/presentation.xml').async('string'), 'application/xml');
  const ids = presDoc.getElementsByTagNameNS(P_NS, 'sldId');
  ids.item(0).parentNode.insertBefore(ids.item(1), ids.item(0));
  zip.file('ppt/presentation.xml', new XMLSerializer().serializeToString(presDoc));
  const template = await zip.generateAsync({ type: 'nodebuffer' });

  const layout = await parsePptxLayout(template);
  assert.match(layout.slides[0].textBoxes.map(b => b.originalText).join(' '), /SECOND SOURCE/);
  assert.match(layout.slides[1].textBoxes.map(b => b.originalText).join(' '), /FIRST SOURCE/);
  const deck = layout.slides.map((slide, i) => ({
    templateSlideIndex: i,
    boxes: slide.textBoxes.map((box, j) => ({ ...box, text: j === 0 ? `EXPERIENCE ${i + 1}` : '' })),
  }));
  const result = await renderDeckInPlace(deck, template);
  const output = await parsePptxLayout(result);
  assert.match(output.slides[0].textBoxes.map(b => b.originalText).join(' '), /EXPERIENCE 1/);
  assert.match(output.slides[1].textBoxes.map(b => b.originalText).join(' '), /EXPERIENCE 2/);
  assert.equal(output.slides[1].pics.length, 1);
  const outputZip = await JSZip.loadAsync(result);
  const graphicSlideXml = await outputZip.file('ppt/slides/slide2.xml').async('string');
  const originalGraphicSlideXml = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.equal((graphicSlideXml.match(/<p:sp>/g) || []).length,
    (originalGraphicSlideXml.match(/<p:sp>/g) || []).length);
  assert.match(graphicSlideXml, /<p:graphicFrame\b/);
  assert.match(graphicSlideXml, /Alpha/);
  const sharedLayoutXml = (await Promise.all(Object.keys(outputZip.files)
    .filter(p => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(p))
    .map(p => outputZip.file(p).async('string')))).join(' ');
  assert.match(sharedLayoutXml, /BRAND MARK/);
  assert.match(sharedLayoutXml, /PROJECT 01/);
  assert.ok(fs.statSync(artwork).size > 20 * 1024);
});

test('experience cards contribute edited details and narrow decorative bars stay empty', () => {
  const norm = __mapperInternals.normalizePortfolio({
    experiences: [{
      company: '서비스 개선',
      bullets: ['고객 인터뷰 12회', '이탈률 20% 개선'],
      skills: [{ name: 'React' }, 'Figma'],
    }],
  });
  assert.equal(norm.projects[0].title, '서비스 개선');
  assert.match(norm.projects[0].task, /고객 인터뷰 12회/);
  assert.deepEqual(norm.projects[0].techStack, ['React', 'Figma']);

  const layout = {
    slideSize: { widthPt: 720, heightPt: 540 },
    slides: [{ textBoxes: [
      { shapeId: 'slide0_sp2', x: 12, y: 20, w: 35, h: 400, fontPt: 20, originalText: '장식', role: 'body' },
      { shapeId: 'slide0_sp3', x: 80, y: 80, w: 480, h: 250, fontPt: 18, originalText: '본문', role: 'body' },
    ] }],
  };
  const { slots } = __mapperInternals.buildSlots(layout, { templateSlideIndex: 0, sectionType: 'toc' });
  assert.equal(slots[0].semanticRole, 'decor');
  assert.equal(slots[0].decorative, true);
  assert.equal(slots[1].bodyCapable, true);
});

test('cover template with two title shapes keeps two distinct headings', async () => {
  const sample = fs.readFileSync(path.resolve(here, '../../../test-inplace-out.pptx'));
  const layout = await parsePptxLayout(sample);
  const norm = __mapperInternals.normalizePortfolio({
    userName: '김유신', targetCompany: '코코네', targetPosition: '프론트엔드 개발자',
    headline: '문제를 끝까지 검증합니다',
  });
  const step = { templateSlideIndex: 0, sectionType: 'cover', sectionParam: null };
  const ctx = __mapperInternals.buildContext(norm, step);
  const { slots, slideW, slideH } = __mapperInternals.buildSlots(layout, step);
  const units = __mapperInternals.buildUnits(slots, slideW, slideH);
  const items = __mapperInternals.buildSectionItems(step, ctx);
  const filled = __mapperInternals.fillByUnits(step, ctx, slots, units, items, slideW);
  const headings = slots.filter(s => s.semanticRole === 'title').map(s => filled.get(s.shapeId)?.text);
  assert.deepEqual(headings, ['김유신 포트폴리오', '코코네 프론트엔드 개발자']);
});
