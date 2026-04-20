/**
 * textUtils.js
 * 포트폴리오/경험 도메인에서 공통으로 쓰이는 순수 텍스트 유틸.
 * - stripMd: 가벼운 마크다운 제거 (에디터/리스트 표시용)
 * - strip:   풍부한 마크다운 제거 (PPT/PDF 렌더링용, 배열도 수용)
 * - toBullets / smartBullets: 줄바꿈/문장 기반 bullet 분리
 * - shorten: 글자수 기준 말줄임
 * - nameSpaced: 3글자 한글 이름 간격 처리
 * - extractFields: 경험 객체 → 섹션별 필드 정규화
 */

/** 가벼운 마크다운 제거 — 인라인/리스트/제목 기호 + 이모지 정리. */
export function stripMd(s) {
  if (!s) return '';
  return String(s)
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s/gm, '')
    .replace(/^[-•*]\s/gm, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .trim();
}

/** 풍부한 마크다운 제거 — PPT/PDF 렌더 전 클린업. 배열이면 ', '로 합침. */
export function strip(txt) {
  if (txt == null) return '';
  const s = Array.isArray(txt) ? txt.join(', ') : String(txt);
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s*/gm, '')
    .trim();
}

/** 줄바꿈 기준 bullet 분리 — 단순 라인 기반. */
export function toBullets(text, max = 5) {
  if (!text) return [];
  return text
    .split('\n')
    .map(l => strip(l.replace(/^(\d+[.)]\s*|[-•▸■□·]\s*)/, '').trim()))
    .filter(l => l.length > 3)
    .slice(0, max);
}

/** 줄바꿈 실패 시 문장 단위로 재분할하는 영리한 bullet. PPT용. */
export function smartBullets(text, maxItems = 4, maxChars = 80) {
  if (!text) return [];
  const raw = strip(text);
  if (!raw) return [];
  const byLine = raw
    .split('\n')
    .map(l => strip(l.replace(/^(\d+[.)]\s*|[-•▸■□·]\s*)/, '').trim()))
    .filter(l => l.length > 8);
  if (byLine.length >= 2) {
    const result = [];
    for (const line of byLine) {
      if (result.length >= maxItems) break;
      if (line.length <= maxChars) { result.push(line); continue; }
      const sub = line.split(/(?<=[.,;])/g).reduce((acc, s) => {
        const cur = acc[acc.length - 1] || '';
        if ((cur + s).length > maxChars && cur.length > 0) { acc.push(s.trim()); }
        else { acc[acc.length - 1] = (cur + s).trim(); }
        return acc;
      }, [line.slice(0, maxChars)]);
      result.push(...sub.slice(0, maxItems - result.length));
    }
    return result.slice(0, maxItems);
  }
  const sentences = raw.split(/(?<=[.!?。])/g).map(s => s.trim()).filter(s => s.length > 5);
  if (sentences.length <= 1) return [raw];
  const chunks = [];
  let cur = '';
  for (const s of sentences) {
    if (cur.length + s.length > maxChars && cur.length > 0) {
      chunks.push(cur.trim());
      cur = s + ' ';
      if (chunks.length >= maxItems - 1) {
        cur += sentences.slice(sentences.indexOf(s) + 1).join(' ');
        break;
      }
    } else { cur += s + ' '; }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.slice(0, maxItems);
}

/** 글자수 기준 말줄임. */
export function shorten(txt, max = 60) {
  if (!txt) return '';
  const s = strip(txt);
  return s.length > max ? s.slice(0, max) + '...' : s;
}

/** 3글자 한글 이름은 " "를 끼워 가독성 향상. */
export function nameSpaced(name) {
  if (!name) return name;
  const n = name.trim();
  if (n.length === 3 && /[가-힣]/.test(n)) return n[0] + ' ' + n[1] + ' ' + n[2];
  return n;
}

/**
 * 경험(exp) 객체에서 섹션 필드를 정규화해 반환.
 * structuredResult → frameworkContent → sections 순 fallback.
 */
export function extractFields(exp) {
  const sr = exp.structuredResult || {};
  const fc = exp.frameworkContent || {};
  const fs = {};
  (exp.sections || []).forEach(s => {
    const t = (s.title || '').replace(/\s/g, '');
    const c = s.content?.trim();
    if (!c) return;
    if (/소개|intro/i.test(t)) fs.intro = fs.intro || c;
    else if (/개요|overview|배경/i.test(t)) fs.overview = fs.overview || c;
    else if (/진행|task|문제|일/i.test(t)) fs.task = fs.task || c;
    else if (/과정|process/i.test(t)) fs.process = fs.process || c;
    else if (/결과물|output/i.test(t)) fs.output = fs.output || c;
    else if (/성장|growth|배운/i.test(t)) fs.growth = fs.growth || c;
    else if (/역량|competency/i.test(t)) fs.competency = fs.competency || c;
  });
  const g = k => strip(sr[k]?.trim?.() || fc[k]?.trim?.() || fs[k]?.trim?.() || '');
  return {
    intro: g('intro'),
    overview: g('overview'),
    task: g('task'),
    process: g('process'),
    output: g('output'),
    growth: g('growth'),
    competency: g('competency'),
    description: strip(exp.description?.trim() || ''),
    aiSummary: strip(exp.aiSummary?.trim() || sr.projectOverview?.summary?.trim() || ''),
    keyExperiences: sr.keyExperiences || [],
    projectOverview: sr.projectOverview || {},
  };
}
