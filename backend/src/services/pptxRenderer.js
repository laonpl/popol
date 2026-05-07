// pptxgenjs로 백지에서 슬라이드를 다시 그린다.
// 원본 템플릿의 배경/장식 도형/이미지 → 그대로 재현.
// 그 위에 AI가 매핑한 텍스트를 autofit 으로 폰트 축소 후 그려넣어 박스 오버플로우를 방지한다.

import pptxgenjs from 'pptxgenjs';
import { shrinkToFit } from './autofit.js';

const PtToInch = (pt) => pt / 72;

function hexNoHash(c) {
  if (!c) return '111827';
  return String(c).replace('#', '').slice(0, 6).toUpperCase();
}

function styleForEmphasis(emphasis, theme, role) {
  if (emphasis === 'metric') {
    return { bold: true, color: hexNoHash(theme.accent), scale: 1.5 };
  }
  if (emphasis === 'title' || role === 'title') {
    return { bold: true, color: hexNoHash(theme.heading), scale: 1.0 };
  }
  if (role === 'heading' || role === 'subtitle') {
    return { bold: true, color: hexNoHash(theme.text), scale: 1.0 };
  }
  return { bold: false, color: hexNoHash(theme.text), scale: 1.0 };
}

// 장식 도형을 슬라이드에 그린다.
function drawDecor(slide, pres, decor) {
  const opts = {
    x: PtToInch(decor.x),
    y: PtToInch(decor.y),
    w: PtToInch(decor.w),
    h: PtToInch(decor.h),
  };
  if (decor.fill) opts.fill = { color: hexNoHash(decor.fill) };
  if (decor.lineColor && decor.lineWidthPt > 0) {
    opts.line = { color: hexNoHash(decor.lineColor), width: Math.max(0.5, decor.lineWidthPt) };
  }
  if (decor.rotation) opts.rotate = decor.rotation;

  const shapeMap = {
    rect: pres.ShapeType.rect,
    roundRect: pres.ShapeType.roundRect,
    ellipse: pres.ShapeType.ellipse,
    triangle: pres.ShapeType.triangle,
    line: pres.ShapeType.line,
  };
  const shapeType = shapeMap[decor.shapeKind] || pres.ShapeType.rect;

  // 채움이나 외곽선 둘 중 하나라도 있어야 그림
  if (!opts.fill && !opts.line) return;
  slide.addShape(shapeType, opts);
}

function drawPic(slide, pic) {
  if (!pic.dataUrl) return;
  slide.addImage({
    data: pic.dataUrl,
    x: PtToInch(pic.x),
    y: PtToInch(pic.y),
    w: PtToInch(pic.w),
    h: PtToInch(pic.h),
  });
}

/**
 * @param {Array} deck — geminiMapper.mapDeck() 결과
 * @param {Object} layout — templateParser.parsePptxLayout() 결과
 * @returns {Promise<Buffer>}
 */
export async function renderDeckToPptx(deck, layout) {
  const pres = new pptxgenjs();
  const { theme, slideSize, slides: tplSlides } = layout;

  pres.defineLayout({
    name: 'FitPolyLayout',
    width: PtToInch(slideSize.widthPt),
    height: PtToInch(slideSize.heightPt),
  });
  pres.layout = 'FitPolyLayout';

  for (const slidePlan of deck) {
    const slide = pres.addSlide();
    const tpl = tplSlides[slidePlan.templateSlideIndex] || {};

    // 1) 배경: 슬라이드 배경 색 → 없으면 테마 bg
    const bgColor = tpl.bg || theme.bg || '#FFFFFF';
    slide.background = { color: hexNoHash(bgColor) };

    // 2) 장식 도형 + 이미지 — z-index 낮은 것부터(원본 그리기 순서대로)
    const layered = [
      ...(tpl.decor || []).map(d => ({ ...d, _kind: 'decor' })),
      ...(tpl.pics || []).map(p => ({ ...p, _kind: 'pic' })),
    ].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const item of layered) {
      if (item._kind === 'decor') drawDecor(slide, pres, item);
      else drawPic(slide, item);
    }

    // 3) 텍스트 박스 — 항상 최상위
    for (const box of slidePlan.boxes) {
      if (!box.text) continue;
      const baseStyle = styleForEmphasis(box.emphasis, theme, box.role);
      const basePt = Math.max(10, box.fontPt * baseStyle.scale);

      const fit = shrinkToFit({
        text: box.text,
        boxWidthPt: box.w,
        boxHeightPt: box.h,
        basePt,
        padPt: 4,
      });

      slide.addText(fit.lines.join('\n'), {
        x: PtToInch(box.x),
        y: PtToInch(box.y),
        w: PtToInch(box.w),
        h: PtToInch(box.h),
        fontSize: fit.fontSize,
        fontFace: box.fontFace || theme.bodyFont || 'Pretendard',
        bold: baseStyle.bold || box.bold,
        color: hexNoHash(box.color || baseStyle.color),
        align: 'left',
        valign: 'top',
        margin: 4,
        shrinkText: true,
        wrap: true,
      });
    }
  }

  const buf = await pres.write({ outputType: 'nodebuffer' });
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}
