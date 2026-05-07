// 텍스트가 박스를 넘치지 않도록 폰트 크기를 점진적으로 줄이는 유틸.
// PPT 좌표계는 EMU(914400/inch)지만, 박스/폰트는 pt 단위로 정규화하여 계산한다.
// 한국어 혼용 폰트 평균 글자 폭은 fontPt * 0.55, 행간 1.3 가정.

const KO_CHAR_WIDTH_RATIO = 0.55;
const LINE_HEIGHT = 1.3;
const MIN_PT = 8;
const MAX_PASSES = 16;

export function shrinkToFit({ text, boxWidthPt, boxHeightPt, basePt, padPt = 4 }) {
  if (!text) return { fontSize: basePt, lines: [''] };
  const innerW = Math.max(8, boxWidthPt - padPt * 2);
  const innerH = Math.max(8, boxHeightPt - padPt * 2);
  let pt = basePt;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const charPx = pt * KO_CHAR_WIDTH_RATIO;
    const charsPerLine = Math.max(1, Math.floor(innerW / charPx));
    const lines = wrapText(text, charsPerLine);
    const neededH = lines.length * pt * LINE_HEIGHT;
    if (neededH <= innerH) return { fontSize: pt, lines };
    pt *= 0.92;
    if (pt < MIN_PT) {
      const charPx2 = MIN_PT * KO_CHAR_WIDTH_RATIO;
      const cpl2 = Math.max(1, Math.floor(innerW / charPx2));
      const maxLines = Math.max(1, Math.floor(innerH / (MIN_PT * LINE_HEIGHT)));
      const wrapped = wrapText(text, cpl2).slice(0, maxLines);
      // 마지막 줄이 잘리면 말줄임
      if (wrapped.length === maxLines && wrapText(text, cpl2).length > maxLines) {
        const last = wrapped[maxLines - 1];
        wrapped[maxLines - 1] = last.slice(0, Math.max(1, last.length - 1)) + '…';
      }
      return { fontSize: MIN_PT, lines: wrapped };
    }
  }
  return { fontSize: pt, lines: wrapText(text, Math.max(1, Math.floor(innerW / (pt * KO_CHAR_WIDTH_RATIO)))) };
}

// 단어 경계 우선, 한국어는 글자 단위로도 안전하게 wrap.
function wrapText(text, charsPerLine) {
  const out = [];
  for (const para of String(text).split(/\r?\n/)) {
    if (!para) { out.push(''); continue; }
    let buf = '';
    const tokens = para.match(/\S+\s*|\s+/g) || [para];
    for (const tok of tokens) {
      if ((buf + tok).length <= charsPerLine) {
        buf += tok;
      } else if (tok.length > charsPerLine) {
        if (buf) { out.push(buf); buf = ''; }
        for (let i = 0; i < tok.length; i += charsPerLine) {
          const chunk = tok.slice(i, i + charsPerLine);
          if (i + charsPerLine >= tok.length) buf = chunk;
          else out.push(chunk);
        }
      } else {
        if (buf) out.push(buf);
        buf = tok;
      }
    }
    if (buf) out.push(buf);
  }
  return out;
}

// AI 프롬프트에 넘겨줄 박스별 maxChars 추정. 베이스 폰트로 박스를 가득 채울 때 들어가는 문자 수.
export function estimateMaxChars({ boxWidthPt, boxHeightPt, basePt }) {
  const innerW = Math.max(8, boxWidthPt - 8);
  const innerH = Math.max(8, boxHeightPt - 8);
  const charPx = Math.max(4, basePt * KO_CHAR_WIDTH_RATIO);
  const charsPerLine = Math.max(1, Math.floor(innerW / charPx));
  const lines = Math.max(1, Math.floor(innerH / (basePt * LINE_HEIGHT)));
  return Math.max(8, Math.floor(charsPerLine * lines * 0.85)); // 15% 버퍼
}

export const EMU_PER_PT = 12700;
export const emuToPt = (emu) => Math.round((Number(emu) || 0) / EMU_PER_PT * 100) / 100;
