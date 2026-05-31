// 텍스트가 박스를 넘치지 않도록 폰트 크기를 점진적으로 줄이는 유틸.
// PPT 좌표계는 EMU(914400/inch)지만, 박스/폰트는 pt 단위로 정규화하여 계산한다.
// 한국어 혼용 폰트 평균 글자 폭은 fontPt * 0.55, 행간 1.3 가정.

const KO_CHAR_WIDTH_RATIO = 0.55;
const LINE_HEIGHT = 1.3;
const MIN_PT = 6;   // 8 → 6: 더 작은 폰트까지 축소 허용 (내용 짤림 방지)
const MAX_PASSES = 20; // 16 → 20: 더 많은 단계로 정밀 축소

// 텍스트 구성으로 평균 글자폭 비율(× fontPt)을 추정.
// Why: 고정 0.55 는 한글 위주 텍스트에서 글자폭을 과소평가한다(한글은 거의 정사각 ≈0.95×).
//   → 한 줄에 들어가는 글자 수를 과대평가 → 필요한 줄 수를 과소평가 → 폰트가 너무 크게 책정되어
//   박스를 넘치고, normAutofit 을 무시하는 PDF 변환기에서 "글이 나오다가 마는" 잘림이 발생했다.
//   글자별 실제 폭(한글/한자/가나·전각 ≈0.95, 영문 대문자 ≈0.66, 영문 소문자·숫자·기호 ≈0.5)을
//   평균내어 한글·영문 혼용 모두 정확히 맞춘다.
// 글자 1개의 폭 비율(× fontPt).
function charRatio(code) {
  if (code === 0x20) return 0.35;
  if ((code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x1100 && code <= 0x11FF) ||
      (code >= 0x3130 && code <= 0x318F) || (code >= 0x3040 && code <= 0x30FF) ||
      (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0xFF00 && code <= 0xFFEF)) return 0.95; // CJK 전각
  if (code >= 0x41 && code <= 0x5A) return 0.66;  // A-Z
  return 0.5;                                     // 소문자·숫자·기호
}
// 한 줄의 실제 폭(em 단위, × fontPt 하면 pt).
function lineWidthEm(text) {
  let sum = 0;
  for (const ch of String(text || '')) sum += charRatio(ch.codePointAt(0));
  return sum;
}
function measureWidthRatio(text) {
  const s = String(text || '');
  let sum = 0, n = 0;
  for (const ch of s) { sum += charRatio(ch.codePointAt(0)); n++; }
  return n ? Math.max(0.5, sum / n) : KO_CHAR_WIDTH_RATIO;
}

export function shrinkToFit({ text, boxWidthPt, boxHeightPt, basePt, padPt = 4 }) {
  if (!text) return { fontSize: basePt, lines: [''] };
  const innerW = Math.max(8, boxWidthPt - padPt * 2);
  const innerH = Math.max(8, boxHeightPt - padPt * 2);
  const ratio = measureWidthRatio(text);
  let pt = basePt;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const charPx = pt * ratio;
    const charsPerLine = Math.max(1, Math.floor(innerW / charPx));
    const lines = wrapText(text, charsPerLine);
    const neededH = lines.length * pt * LINE_HEIGHT;
    // 높이뿐 아니라 가장 넓은 줄의 실제 폭도 박스 안에 들어가야 함(줄별 한글 밀도 편차 대비).
    const widestPt = lines.reduce((m, l) => Math.max(m, lineWidthEm(l)), 0) * pt;
    if (neededH <= innerH && widestPt <= innerW) return { fontSize: pt, lines };
    pt *= 0.92;
    if (pt < MIN_PT) {
      const charPx2 = MIN_PT * ratio;
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
// 자른 텍스트는 shrinkToFit + normAutofit 으로 폰트가 자동 축소되므로 버퍼 거의 없이 실제 용량을 그대로 노출.
export function estimateMaxChars({ boxWidthPt, boxHeightPt, basePt, text = null }) {
  const innerW = Math.max(8, boxWidthPt - 8);
  const innerH = Math.max(8, boxHeightPt - 8);
  // 텍스트가 있으면 실제 구성으로, 없으면 한글 위주 포트폴리오 기준(0.62)으로 폭 추정.
  // (고정 0.55 는 한글에서 한 줄 글자 수를 과대평가 → AI 가 박스보다 많이 써서 넘침)
  const ratio = text ? measureWidthRatio(text) : 0.62;
  const charPx = Math.max(4, basePt * ratio);
  const charsPerLine = Math.max(1, Math.floor(innerW / charPx));
  const lines = Math.max(1, Math.floor(innerH / (basePt * LINE_HEIGHT)));
  return Math.max(12, Math.floor(charsPerLine * lines * 0.95)); // 5% 버퍼만 (기존 15% → 자린 내용 복구)
}

export const EMU_PER_PT = 12700;
export const emuToPt = (emu) => Math.round((Number(emu) || 0) / EMU_PER_PT * 100) / 100;
