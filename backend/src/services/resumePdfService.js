// 포트폴리오 데이터 → 격식 있는 채용용 이력서 PDF.
// 포트폴리오 PDF(renderPortfolioPdf)가 표지 + 전체 서사형 문서라면, 이쪽은
// 인적사항·학력·경력·기술·어학·자격/수상만 단일 컬럼으로 압축한 1~2페이지 이력서다.
// 텍스트 내보내기(exportForResume)와 동일한 필드를 읽으며 AI 미사용·결정론.
import { htmlToPdf } from './portfolioPdfService.js';
import { sanitizeArtifactsDeep } from '../utils/sanitizeText.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
));
const text = (v) => esc(v).replace(/\r?\n/g, '<br/>');
const skillName = (s) => typeof s === 'string' ? s : (s?.name || '');
const nonEmpty = (arr) => Array.isArray(arr) ? arr.filter(Boolean) : [];
// 전달한 필드 중 하나라도 실제 값(빈 문자열·공백 제외)이 있으면 true.
// 빈 칸만 있는 항목을 걸러 → 항목이 전부 비면 섹션도 자동 제외된다.
const filled = (...vals) => vals.some(v =>
  Array.isArray(v) ? v.some(x => String(x ?? '').trim() !== '') : String(v ?? '').trim() !== ''
);
const meta = (parts, sep = ' · ') => parts.filter(Boolean).map(esc).join(sep);

function buildHeader(p) {
  const c = p.contact || {};
  const rows = [
    ['Email', c.email], ['Phone', c.phone], ['GitHub', c.github],
    ['LinkedIn', c.linkedin], ['Website', c.website],
  ].filter(([, v]) => v);
  return `<header class="hd">
    <h1 class="name">${esc(p.userName || p.title || '이름')}${p.nameEn ? `<span class="name-en">${esc(p.nameEn)}</span>` : ''}</h1>
    ${p.headline ? `<p class="headline">${text(p.headline)}</p>` : ''}
    ${rows.length ? `<ul class="contact">${rows.map(([k, v]) => `<li><span class="ck">${k}</span><span class="cv">${esc(v)}</span></li>`).join('')}</ul>` : ''}
  </header>`;
}

function section(title, en, inner) {
  if (!inner || !inner.trim()) return '';
  return `<section class="sec">
    <div class="sec-h"><h2>${esc(title)}</h2><span class="en">${esc(en)}</span></div>
    ${inner}
  </section>`;
}

function buildEducation(p) {
  return nonEmpty(p.education)
    .filter(e => filled(e.school, e.name, e.major, e.degree, e.period, e.description, e.detail))
    .map(e => {
    const name = `${esc(e.school || e.name || '')}${e.nameEn ? ` <span class="it-sub">(${esc(e.nameEn)})</span>` : ''}`;
    const sub = meta([e.major, e.degree], ' '); // "컴퓨터공학과 학사 재학"
    const head = `<span class="it-title">${name}${sub ? ` <span class="it-edu-sub">${sub}</span>` : ''}</span>${e.period ? `<span class="it-sep">|</span><span class="it-period">${esc(e.period)}</span>` : ''}`;
    return `<div class="item">
      <div class="it-head">${head}</div>
      ${(e.description || e.detail) ? `<div class="it-desc">${text(e.description || e.detail)}</div>` : ''}
    </div>`;
  }).join('');
}

function buildExperiences(p) {
  return nonEmpty(p.experiences)
    .filter(e => filled(e.title, e.role, e.description, e.period, e.date, e.achievements))
    .map(e => {
    const period = e.period || e.date;
    const ach = nonEmpty(e.achievements);
    // "제목 | 기간 | 역할" 한 줄 헤더 + 핵심 성과 불릿. 성과가 없으면 설명을 불릿으로.
    const bullets = ach.length ? ach : (e.description ? [e.description] : []);
    const head = [
      `<span class="it-title">${esc(e.title || '')}</span>`,
      period ? `<span class="it-period">${esc(period)}</span>` : '',
      e.role ? `<span class="it-role">${esc(e.role)}</span>` : '',
    ].filter(Boolean).join('<span class="it-sep">|</span>');
    return `<div class="item">
      <div class="it-head">${head}</div>
      ${bullets.length ? `<ul class="bullets">${bullets.map(a => `<li>${text(a)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }).join('');
}

function buildSkills(p) {
  const skills = p.skills || {};
  const CAT = { languages: 'Languages', frameworks: 'Frameworks & Libraries', tools: 'Tools', others: 'Others' };
  const rows = Object.entries(skills)
    .map(([c, items]) => [CAT[c] || c, nonEmpty(items).map(skillName).filter(Boolean)])
    .filter(([, items]) => items.length);
  if (!rows.length) return '';
  return `<div class="skills">${rows.map(([cat, items]) => `<div class="sk-row">
    <span class="sk-cat">${esc(cat)}</span>
    <span class="sk-val">${items.map(esc).join(', ')}</span>
  </div>`).join('')}</div>`;
}

function buildLanguages(p) {
  return nonEmpty(p.extracurricular?.languages)
    .filter(l => filled(l.name, l.score, l.date))
    .map(l => `<div class="item-line">
    <span class="it-title">${esc(l.name || '')}</span>
    ${l.score ? `<span class="ln-score">${esc(l.score)}</span>` : ''}
    ${l.date ? `<span class="it-period">${esc(l.date)}</span>` : ''}
  </div>`).join('');
}

function buildAwards(p) {
  return nonEmpty(p.awards)
    .filter(a => filled(a.title, a.organization, a.date))
    .map(a => `<div class="item-line">
    <span class="it-title">${esc(a.title || '')}</span>
    ${a.organization ? `<span class="it-meta-inline">${esc(a.organization)}</span>` : ''}
    ${a.date ? `<span class="it-period">${esc(a.date)}</span>` : ''}
  </div>`).join('');
}

export function buildResumeHtml(p) {
  const body = [
    buildHeader(p),
    section('학력', 'Education', buildEducation(p)),
    section('경력 및 프로젝트', 'Experience', buildExperiences(p)),
    section('보유 기술', 'Skills', buildSkills(p)),
    section('어학', 'Language', buildLanguages(p)),
    section('자격 및 수상', 'Certificates & Awards', buildAwards(p)),
  ].join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"/>
<style>
  @page { size: A4; margin: 16mm 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --ink: #0F172A; --body: #334155; --sub: #64748B;
    --line: #E2E8F0; --accent: #2563EB;
  }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'Pretendard Variable', Pretendard, -apple-system, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    color: var(--body); font-size: 10.5pt; line-height: 1.65; word-break: keep-all; padding: 0 18mm;
  }

  /* ── 헤더(인적사항) ── */
  .hd { border-bottom: 2.5px solid var(--ink); padding-bottom: 5mm; margin-bottom: 6mm; }
  .name { font-size: 26pt; font-weight: 800; color: var(--ink); line-height: 1.2; }
  .name-en { font-size: 12pt; font-weight: 600; color: var(--sub); margin-left: 10px; letter-spacing: 0.03em; }
  .headline { margin-top: 2.5mm; font-size: 11pt; font-weight: 600; color: var(--accent); }
  .contact { margin-top: 3.5mm; list-style: none; display: flex; flex-direction: column; gap: 1mm; }
  .contact li { font-size: 9.5pt; color: var(--body); display: flex; gap: 8px; }
  .contact .ck { flex: 0 0 18mm; font-weight: 700; color: var(--ink); }
  .contact .cv { color: var(--body); word-break: break-all; }

  /* ── 섹션 ── */
  /* break-inside:avoid 를 섹션에 걸면 섹션이 통째로 다음 페이지로 밀려 공백이 생긴다.
     섹션은 페이지를 넘나들며 이어지고, 쪼개짐 방지는 개별 .item 단위로만 적용. */
  .sec { margin-top: 6.5mm; }
  .sec-h {
    display: flex; align-items: baseline; gap: 9px;
    border-bottom: 1px solid var(--line); padding-bottom: 2.5mm; margin-bottom: 3.5mm; break-after: avoid-page;
  }
  .sec-h h2 { font-size: 12.5pt; font-weight: 800; color: var(--ink); }
  .sec-h .en { margin-left: auto; font-size: 8pt; font-weight: 700; letter-spacing: 0.16em; color: var(--sub); text-transform: uppercase; }

  /* ── 항목(학력·경력) ── */
  .item { padding: 2.8mm 0; break-inside: avoid; }
  .item + .item { border-top: 1px dashed var(--line); }
  .it-title { font-size: 11pt; font-weight: 700; color: var(--ink); }
  .it-sub { font-weight: 500; color: var(--sub); font-size: 9pt; }
  .it-period { flex: 0 0 auto; font-size: 9pt; font-weight: 600; color: var(--sub); }
  .it-desc { font-size: 9.8pt; color: var(--body); margin-top: 1.5mm; }
  /* 경력·프로젝트: "제목 | 기간 | 역할" 한 줄 헤더 */
  .it-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
  .it-head .it-title { font-size: 11pt; font-weight: 700; color: var(--ink); }
  .it-head .it-period { flex: 0 0 auto; font-size: 9.5pt; font-weight: 600; color: var(--sub); }
  .it-head .it-role { font-size: 9.5pt; font-weight: 600; color: var(--accent); }
  .it-edu-sub { font-size: 9.8pt; font-weight: 500; color: var(--body); }
  .it-sep { color: var(--line); font-size: 9pt; }
  .bullets { margin: 1.8mm 0 0; padding: 0; list-style: none; }
  .bullets li { position: relative; padding-left: 11px; font-size: 9.8pt; color: var(--body); margin-top: 1mm; }
  .bullets li::before { content: ''; position: absolute; left: 0; top: 6.5px; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }

  /* ── 한 줄 항목(어학·수상) ── */
  .item-line { display: flex; align-items: baseline; gap: 8px; padding: 2.2mm 0; break-inside: avoid; }
  .item-line + .item-line { border-top: 1px dashed var(--line); }
  .item-line .it-period { margin-left: auto; }
  .ln-score { font-size: 9.5pt; font-weight: 600; color: var(--body); }
  .it-meta-inline { font-size: 9.5pt; color: var(--sub); }

  /* ── 보유 기술 ── */
  .skills { display: flex; flex-direction: column; gap: 2mm; }
  .sk-row { display: flex; gap: 10px; align-items: baseline; }
  .sk-cat { flex: 0 0 24mm; font-size: 9.5pt; font-weight: 700; color: var(--ink); }
  .sk-val { flex: 1; font-size: 9.8pt; color: var(--body); }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export async function renderResumePdf(data) {
  return htmlToPdf(buildResumeHtml(sanitizeArtifactsDeep(data)));
}
