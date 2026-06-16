// 노션형 포트폴리오 → 합격자 스타일 PDF 문서 렌더러.
// 템플릿 슬롯에 텍스트를 끼워 넣는 방식(내용 누락·빈 박스의 원인) 대신,
// 자체 설계한 A4 문서 레이아웃에 핵심 내용을 흐름대로 배치하고
// Puppeteer(Chromium 인쇄 엔진)로 PDF를 만든다. 외부 의존 없음(AI 미사용·결정론).
//
// 구성 원칙(사용자 피드백 반영):
//  - 간결: 프로젝트는 문제 정의 → 해결 과정 → 성과 3단만, 교과목/상세 표는 요약 칩으로
//  - 수치는 텍스트가 아니라 전/후 비교 막대 차트로 시각화

import { sanitizeArtifactsDeep } from '../utils/sanitizeText.js';

// ── 텍스트 헬퍼 ──────────────────────────────────────────────────────────
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
));
const text = (v) => esc(v).replace(/\r?\n/g, '<br/>');
// 성과 문장에서 수치를 강조 — 합격자 포트폴리오의 "숫자가 먼저 보이는" 인상
const hiNum = (escaped) => escaped.replace(
  /(\d[\d,.]*\s*(?:%|건|배|점|시간|분|초|명|회|개|만|억|원|위|등|개월|주|일|kg|km|ms|p)?)/g,
  '<strong class="num">$1</strong>'
);
const skillName = (s) => typeof s === 'string' ? s : (s?.name || '');
const nonEmpty = (arr) => Array.isArray(arr) ? arr.filter(Boolean) : [];
const clip = (s, n) => {
  const t = String(s ?? '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const chips = (list, cls = 'chip') => {
  const items = nonEmpty(list).map(skillName).filter(Boolean);
  if (!items.length) return '';
  return `<div class="chips">${items.map(i => `<span class="${cls}">${esc(i)}</span>`).join('')}</div>`;
};

const row = (label, value, accent = false) => {
  if (!value) return '';
  const body = accent ? hiNum(text(value)) : text(value);
  return `<div class="row${accent ? ' row-accent' : ''}">
    <div class="lab">${esc(label)}</div>
    <div class="val">${body}</div>
  </div>`;
};

// ── 지표 파싱: "12건 → 0건", "8시간 → 10분" 류를 전/후 수치로 분해 ────────
const TIME_FACTOR = { '시간': 60, '분': 1, '초': 1 / 60, '일': 1440, '주': 10080 };

export function parseBeforeAfter(metric) {
  if (!metric) return null;
  const m = String(metric).match(/([\d][\d,.]*)\s*([^\s\d→\-]*)\s*(?:→|->|⇒)\s*([\d][\d,.]*)\s*([^\s\d]*)/);
  if (!m) return null;
  const b = parseFloat(m[1].replace(/,/g, ''));
  const a = parseFloat(m[3].replace(/,/g, ''));
  if (!Number.isFinite(b) || !Number.isFinite(a)) return null;
  const bu = m[2] || m[4] || '';
  const au = m[4] || m[2] || '';
  let bv = b, av = a;
  if (bu !== au) {
    if (TIME_FACTOR[bu] && TIME_FACTOR[au]) { bv = b * TIME_FACTOR[bu]; av = a * TIME_FACTOR[au]; }
    else return null; // 단위가 다른데 환산 불가 → 막대 비교 부적합
  }
  return {
    beforeRaw: `${m[1]}${bu}`, afterRaw: `${m[3]}${au}`,
    beforeV: bv, afterV: av,
  };
}

// ── 섹션 빌더 ────────────────────────────────────────────────────────────

function buildCover(p) {
  const now = new Date();
  const stamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;
  const target = [p.targetCompany, p.targetPosition].filter(Boolean).join(' · ');
  const contact = p.contact || {};
  const contactItems = [
    contact.email && ['EMAIL', contact.email],
    contact.phone && ['PHONE', contact.phone],
    contact.github && ['GITHUB', contact.github],
    contact.linkedin && ['LINKEDIN', contact.linkedin],
    contact.website && ['WEB', contact.website],
  ].filter(Boolean);
  const allSkills = [
    ...nonEmpty(p.skills?.languages), ...nonEmpty(p.skills?.frameworks),
    ...nonEmpty(p.skills?.tools), ...nonEmpty(p.skills?.others),
  ].map(skillName).filter(Boolean);

  return `<div class="cover">
    <div class="cover-top">
      <span class="brand">PORTFOLIO</span>
      <span class="stamp">${esc(stamp)}</span>
    </div>
    <div class="cover-main">
      ${target ? `<div class="target"><span class="target-tag">TARGET</span>${esc(target)}</div>` : ''}
      <h1 class="cover-name">${esc(p.userName || p.title || '포트폴리오')}${p.nameEn ? `<span class="name-en">${esc(p.nameEn)}</span>` : ''}</h1>
      ${p.headline ? `<p class="cover-headline">${text(p.headline)}</p>` : ''}
      ${allSkills.length ? `<div class="cover-skills">${allSkills.slice(0, 10).map(s => `<span class="chip chip-lg">${esc(s)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="cover-bottom">
      ${contactItems.map(([k, v]) => `<div class="cv-contact"><span class="cv-k">${k}</span><span class="cv-v">${esc(v)}</span></div>`).join('')}
    </div>
  </div>`;
}

function buildIntro(p) {
  const keywords = [
    ...nonEmpty(p.values).map(v => v.keyword || v.title),
    ...nonEmpty(p.interests).map(skillName),
  ].filter(Boolean);
  if (!p.headline && !p.valuesEssay && !keywords.length) return '';
  return `
    ${p.headline ? `<p class="intro-headline">“${text(p.headline)}”</p>` : ''}
    ${p.valuesEssay ? `<p class="intro-essay">${text(p.valuesEssay)}</p>` : ''}
    ${keywords.length ? chips(keywords.slice(0, 8), 'chip chip-lg') : ''}
  `;
}

function buildSkills(p) {
  const skills = p.skills || {};
  const CATEGORY = { languages: '언어', frameworks: '프레임워크 · 라이브러리', tools: '도구 · 인프라', others: '기타' };
  const rows = Object.entries(skills)
    .map(([cat, items]) => [CATEGORY[cat] || cat, nonEmpty(items).map(skillName).filter(Boolean)])
    .filter(([, items]) => items.length);
  if (!rows.length) return '';
  return `<div class="skill-table">${rows.map(([cat, items]) => `
    <div class="skill-row">
      <div class="skill-cat">${esc(cat)}</div>
      <div class="skill-items">${items.map(i => `<span class="chip">${esc(i)}</span>`).join('')}</div>
    </div>`).join('')}</div>`;
}

// 지표 1건 → 전/후 비교 막대 차트 카드 (환산 불가하면 큰 숫자 카드로 폴백)
function buildMetricCard(k) {
  const label = k.metricLabel || k.title || '핵심 지표';
  const pa = parseBeforeAfter(k.metric);
  if (!pa) {
    return `<div class="metric-card">
      ${k.metric ? `<div class="m-val">${hiNum(esc(k.metric))}</div>` : ''}
      <div class="m-label">${esc(label)}</div>
      ${k.result ? `<div class="m-result">${hiNum(esc(clip(k.result, 60)))}</div>` : ''}
    </div>`;
  }
  const max = Math.max(pa.beforeV, pa.afterV, 1);
  const bw = Math.max(2.5, (pa.beforeV / max) * 100);
  const aw = Math.max(2.5, (pa.afterV / max) * 100);
  return `<div class="metric-card">
    <div class="m-label">${esc(label)}</div>
    <div class="m-val m-val-sm">${esc(pa.beforeRaw)} <span class="m-arrow">→</span> ${esc(pa.afterRaw)}</div>
    <div class="bar-row">
      <span class="bar-k">전</span>
      <div class="bar-track"><div class="bar bar-before" style="width:${bw}%"></div></div>
      <span class="bar-v">${esc(pa.beforeRaw)}</span>
    </div>
    <div class="bar-row">
      <span class="bar-k">후</span>
      <div class="bar-track"><div class="bar bar-after" style="width:${aw}%"></div></div>
      <span class="bar-v">${esc(pa.afterRaw)}</span>
    </div>
    ${k.result ? `<div class="m-result">${hiNum(esc(clip(k.result, 60)))}</div>` : ''}
  </div>`;
}

function buildExperience(e, idx) {
  const sr = e.structuredResult || {};
  const ov = sr.projectOverview || {};
  const period = e.period || e.date || ov.period || ov.duration || '';
  const role = e.role || ov.role || '';
  const tech = nonEmpty(e.skills).length ? e.skills : nonEmpty(ov.techStack);
  const tags = nonEmpty(e.classify);
  const keyExps = nonEmpty(sr.keyExperiences);

  // 핵심 3단: 문제 정의 → 해결 과정(역할+과정 통합) → 성과
  const solve = [sr.task, sr.process].filter(Boolean).join('\n');
  const detailRows = [
    row('문제 정의', sr.intro),
    row('해결 과정', solve),
    row('성과', sr.output, true),
  ].join('');
  // 구조화 데이터가 없으면 일반 설명이라도 반드시 싣는다 — 내용 누락 방지
  const fallback = !detailRows.trim() && e.description ? row('요약', e.description) : '';

  return `<div class="project">
    <div class="p-head">
      <div class="p-no">PROJECT ${String(idx + 1).padStart(2, '0')}</div>
      ${tags.length ? `<div class="p-tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <h3 class="p-title">${text(e.title || '프로젝트')}</h3>
      ${(role || period) ? `<div class="p-meta">${[role, period].filter(Boolean).map(esc).join('<span class="dot">·</span>')}</div>` : ''}
      ${ov.summary ? `<p class="p-summary">${text(ov.summary)}</p>` : ''}
      ${tech?.length ? chips(tech) : ''}
    </div>
    ${detailRows}${fallback}
    ${keyExps.length ? `<div class="metrics">${keyExps.map(buildMetricCard).join('')}</div>` : ''}
  </div>`;
}

function buildEducationAwards(p) {
  const education = nonEmpty(p.education);
  const awards = nonEmpty(p.awards);
  if (!education.length && !awards.length) return '';
  const eduHtml = education.map(e => `
    <div class="list-item">
      <div class="li-title">${esc(e.school || e.name || '')}${e.nameEn ? ` <span class="li-sub">(${esc(e.nameEn)})</span>` : ''}</div>
      <div class="li-meta">${[e.major, e.degree, e.period].filter(Boolean).map(esc).join(' · ')}</div>
    </div>`).join('');
  const awardHtml = awards.map(a => `
    <div class="list-item">
      <div class="li-title">${esc(a.title || '')}</div>
      <div class="li-meta">${[a.organization, a.date].filter(Boolean).map(esc).join(' · ')}</div>
    </div>`).join('');
  return `<div class="two-col">
    ${education.length ? `<div class="col"><div class="sub-title">학력</div>${eduHtml}</div>` : ''}
    ${awards.length ? `<div class="col"><div class="sub-title">수상 · 자격</div>${awardHtml}</div>` : ''}
  </div>`;
}

// 활동: 표 대신 요약 칩 + 한 줄 항목으로 간결하게
function buildActivities(p) {
  const curr = p.curricular || {};
  const extra = p.extracurricular || {};
  const stats = [
    curr.summary?.credits && `이수 학점 ${curr.summary.credits}`,
    curr.summary?.gpa && `평점 ${curr.summary.gpa}`,
    ...nonEmpty(extra.languages).map(l => [l.name, l.score].filter(Boolean).join(' ')),
    ...nonEmpty(extra.badges).map(b => b.name),
  ].filter(Boolean);
  const details = nonEmpty(extra.details);
  if (!stats.length && !details.length && !extra.summary) return '';
  return `<div class="sub-block">
    <div class="sub-title">활동</div>
    ${extra.summary ? `<p class="plain">${esc(clip(extra.summary, 90))}</p>` : ''}
    ${stats.length ? chips(stats, 'chip chip-lg') : ''}
    ${details.map(d => `<div class="act-line">
      <span class="act-title">${esc(d.title || '')}</span>
      ${d.period ? `<span class="li-sub"> ${esc(d.period)}</span>` : ''}
      ${d.description ? `<span class="act-desc"> — ${esc(clip(d.description, 70))}</span>` : ''}
    </div>`).join('')}
  </div>`;
}

function buildGoals(p) {
  const goals = nonEmpty(p.goals);
  if (!goals.length) return '';
  const TYPE = { short: '단기', mid: '중기', long: '장기' };
  const STATUS = { done: '달성', ing: '진행 중' };
  return `<div class="goal-list">${goals.map(g => `
    <div class="goal-item">
      <span class="goal-type">${esc(TYPE[g.type] || '목표')}</span>
      <div class="goal-body">
        <div class="goal-title">${esc(g.title || '')}${STATUS[g.status] ? ` <span class="goal-status">${STATUS[g.status]}</span>` : ''}</div>
        ${g.description ? `<div class="goal-desc">${esc(clip(g.description, 60))}</div>` : ''}
      </div>
    </div>`).join('')}</div>`;
}

function buildCustomSections(p) {
  const sections = nonEmpty(p.sections).filter(s => s && s.title && typeof s.content === 'string' && s.content.trim());
  if (!sections.length) return '';
  return sections.map(s => `<div class="sub-block">
    <div class="sub-title">${esc(s.title)}</div>
    <p class="plain">${text(s.content)}</p>
  </div>`).join('');
}

function buildClosing(p) {
  const contact = p.contact || {};
  const items = [
    contact.email && ['EMAIL', contact.email],
    contact.phone && ['PHONE', contact.phone],
    contact.github && ['GITHUB', contact.github],
    contact.linkedin && ['LINKEDIN', contact.linkedin],
    contact.website && ['WEB', contact.website],
  ].filter(Boolean);
  return `<div class="closing">
    <div class="closing-thanks">감사합니다.</div>
    <div class="closing-name">${esc(p.userName || '')}${p.nameEn ? ` <span>${esc(p.nameEn)}</span>` : ''}</div>
    ${items.length ? `<div class="closing-contact">${items.map(([k, v]) => `<div class="cv-contact"><span class="cv-k">${k}</span><span class="cv-v">${esc(v)}</span></div>`).join('')}</div>` : ''}
  </div>`;
}

// ── 문서 조립 ────────────────────────────────────────────────────────────

export function buildPortfolioHtml(p) {
  const experiences = nonEmpty(p.experiences);
  const background = [buildEducationAwards(p), buildActivities(p)].filter(s => s.trim()).join('');
  const sections = [
    ['소개', 'About', buildIntro(p)],
    ['기술 역량', 'Skills', buildSkills(p)],
    ['프로젝트 · 경험', 'Projects', experiences.map((e, i) => buildExperience(e, i)).join('')],
    ['학력 · 수상 · 활동', 'Background', background],
    ['목표와 계획', 'Future Plans', buildGoals(p)],
    ['더 보기', 'Appendix', buildCustomSections(p)],
  ].filter(([, , html]) => html && html.trim());

  const body = sections.map(([ko, en, html], i) => `
    <section class="sec">
      <div class="sec-head">
        <span class="sec-no">${String(i + 1).padStart(2, '0')}</span>
        <h2>${esc(ko)}</h2>
        <span class="sec-en">${esc(en)}</span>
      </div>
      ${html}
    </section>`).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"/>
<style>
  @page { size: A4; margin: 13mm 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --ink: #0F172A; --body: #334155; --sub: #64748B;
    --line: #E2E8F0; --accent: #2563EB; --accent-deep: #1D4ED8;
    --accent-soft: #EFF6FF; --bg: #F8FAFC;
  }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'Pretendard Variable', Pretendard, -apple-system, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    color: var(--body); font-size: 10pt; line-height: 1.7; word-break: keep-all;
  }
  strong.num { color: var(--accent-deep); font-weight: 800; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
  .chip {
    display: inline-block; padding: 2.5px 9px; border-radius: 999px;
    background: var(--accent-soft); color: var(--accent-deep);
    font-size: 8.5pt; font-weight: 600; border: 1px solid #DBEAFE;
  }
  .chip-lg { font-size: 9.5pt; padding: 4px 12px; }

  /* ── 표지 ── */
  .cover {
    height: 269mm; padding: 14mm 18mm 12mm; display: flex; flex-direction: column;
    break-after: page; position: relative;
  }
  .cover::before {
    content: ''; position: absolute; left: 18mm; right: 18mm; top: 8mm;
    height: 4px; background: linear-gradient(90deg, var(--accent), #60A5FA); border-radius: 2px;
  }
  .cover-top { display: flex; justify-content: space-between; align-items: baseline; margin-top: 4mm; }
  .brand { font-size: 10pt; font-weight: 800; letter-spacing: 0.35em; color: var(--ink); }
  .stamp { font-size: 9pt; color: var(--sub); letter-spacing: 0.1em; }
  .cover-main { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .target {
    display: inline-flex; align-items: center; gap: 8px; align-self: flex-start;
    font-size: 10.5pt; font-weight: 700; color: var(--ink);
    background: var(--accent-soft); border: 1px solid #DBEAFE; border-radius: 999px;
    padding: 6px 16px 6px 6px; margin-bottom: 14mm;
  }
  .target-tag {
    background: var(--accent); color: #fff; font-size: 8pt; font-weight: 800;
    letter-spacing: 0.12em; border-radius: 999px; padding: 3px 10px;
  }
  .cover-name { font-size: 34pt; font-weight: 800; color: var(--ink); line-height: 1.2; }
  .name-en { font-size: 13pt; font-weight: 600; color: var(--sub); margin-left: 12px; letter-spacing: 0.04em; }
  .cover-headline {
    margin-top: 8mm; font-size: 15pt; font-weight: 600; color: var(--body);
    line-height: 1.55; max-width: 150mm;
    padding-left: 14px; border-left: 4px solid var(--accent);
  }
  .cover-skills { margin-top: 12mm; max-width: 150mm; }
  .cover-bottom {
    border-top: 1px solid var(--line); padding-top: 6mm;
    display: flex; flex-wrap: wrap; gap: 4mm 10mm;
  }
  .cv-contact { display: flex; align-items: baseline; gap: 7px; font-size: 9pt; }
  .cv-k { font-size: 7.5pt; font-weight: 800; letter-spacing: 0.08em; color: var(--accent); }
  .cv-v { color: var(--body); }

  /* ── 섹션 공통 ── */
  .sec { padding: 0 18mm; margin-top: 12mm; }
  .sec-head {
    display: flex; align-items: baseline; gap: 10px;
    border-bottom: 2px solid var(--ink); padding-bottom: 7px; margin-bottom: 7mm;
    break-after: avoid-page;
  }
  .sec-no { font-size: 11pt; font-weight: 800; color: var(--accent); }
  .sec-head h2 { font-size: 15pt; font-weight: 800; color: var(--ink); }
  .sec-en { margin-left: auto; font-size: 8.5pt; font-weight: 600; letter-spacing: 0.2em; color: var(--sub); text-transform: uppercase; }
  .sub-title { font-size: 10.5pt; font-weight: 800; color: var(--ink); margin-bottom: 3mm; }
  .sub-block { margin-top: 7mm; break-inside: avoid; }
  .sub-block:first-child { margin-top: 0; }
  .two-col + .sub-block { margin-top: 7mm; }
  .plain { color: var(--body); }

  /* ── 소개 ── */
  .intro-headline { font-size: 13.5pt; font-weight: 700; color: var(--ink); margin-bottom: 4mm; line-height: 1.5; }
  .intro-essay { margin-bottom: 2mm; max-width: 160mm; }

  /* ── 기술 ── */
  .skill-table { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .skill-row { display: flex; border-top: 1px solid var(--line); }
  .skill-row:first-child { border-top: 0; }
  .skill-cat {
    flex: 0 0 38mm; background: var(--bg); padding: 9px 13px;
    font-size: 9pt; font-weight: 700; color: var(--ink);
  }
  .skill-items { flex: 1; padding: 6px 12px; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }

  /* ── 프로젝트 ── */
  .project {
    border: 1px solid var(--line); border-radius: 12px;
    padding: 7mm 7mm 5mm; margin-bottom: 6mm;
  }
  .p-head { break-inside: avoid; }
  .p-no { font-size: 8pt; font-weight: 800; letter-spacing: 0.18em; color: var(--accent); margin-bottom: 2mm; }
  .p-tags { display: inline-flex; gap: 5px; margin-bottom: 2mm; }
  .tag {
    font-size: 8pt; font-weight: 700; color: var(--sub);
    border: 1px solid var(--line); border-radius: 999px; padding: 1.5px 9px;
  }
  .p-title { font-size: 14pt; font-weight: 800; color: var(--ink); line-height: 1.35; }
  .p-meta { margin-top: 1.5mm; font-size: 9.5pt; font-weight: 600; color: var(--sub); }
  .p-meta .dot { margin: 0 6px; color: var(--line); }
  .p-summary { margin-top: 3mm; color: var(--body); }
  .row {
    display: flex; gap: 12px; padding: 3.2mm 0;
    border-top: 1px dashed var(--line); margin-top: 3.2mm; break-inside: avoid;
  }
  .p-head + .row { margin-top: 4mm; }
  .lab {
    flex: 0 0 52pt; font-size: 8.5pt; font-weight: 800; color: var(--accent);
    letter-spacing: 0.03em; padding-top: 2px;
  }
  .val { flex: 1; color: var(--body); }
  .row-accent {
    background: var(--accent-soft); border: 1px solid #DBEAFE; border-top: 1px solid #DBEAFE;
    border-radius: 10px; padding: 3.2mm 4mm;
  }
  .row-accent .val { color: var(--ink); font-weight: 600; }

  /* ── 지표 차트 ── */
  .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm; margin-top: 4mm; }
  .metric-card {
    background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
    padding: 11px 14px; break-inside: avoid;
  }
  .m-label { font-size: 8.5pt; font-weight: 700; color: var(--sub); }
  .m-val { font-size: 15pt; font-weight: 800; color: var(--accent-deep); line-height: 1.3; }
  .m-val strong.num { color: inherit; }
  .m-val-sm { font-size: 12.5pt; margin: 2px 0 6px; color: var(--ink); }
  .m-arrow { color: var(--accent); }
  .bar-row { display: flex; align-items: center; gap: 7px; margin-top: 4px; }
  .bar-k { flex: 0 0 12px; font-size: 7.5pt; font-weight: 800; color: var(--sub); }
  .bar-track { flex: 1; height: 9px; background: #E2E8F0; border-radius: 5px; overflow: hidden; }
  .bar { height: 100%; border-radius: 5px; }
  .bar-before { background: #94A3B8; }
  .bar-after { background: linear-gradient(90deg, var(--accent), #60A5FA); }
  .bar-v { flex: 0 0 auto; min-width: 36px; font-size: 8pt; font-weight: 800; color: var(--ink); text-align: right; }
  .m-result { font-size: 8.8pt; color: var(--sub); margin-top: 7px; }

  /* ── 학력·수상·활동 ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .col { min-width: 0; }
  .list-item { padding: 3mm 0; border-bottom: 1px solid var(--line); break-inside: avoid; }
  .list-item:last-child { border-bottom: 0; }
  .li-title { font-weight: 700; color: var(--ink); font-size: 10.5pt; }
  .li-sub { font-weight: 500; color: var(--sub); font-size: 9pt; }
  .li-meta { font-size: 9pt; color: var(--sub); margin-top: 1px; }
  .act-line { margin-top: 2.5mm; font-size: 9.5pt; break-inside: avoid; }
  .act-title { font-weight: 700; color: var(--ink); }
  .act-desc { color: var(--sub); }

  /* ── 목표 ── */
  .goal-list { display: flex; flex-direction: column; gap: 3.5mm; }
  .goal-item { display: flex; gap: 12px; align-items: flex-start; break-inside: avoid; }
  .goal-type {
    flex: 0 0 auto; background: var(--ink); color: #fff; font-size: 8pt; font-weight: 800;
    border-radius: 6px; padding: 3px 9px; margin-top: 2px;
  }
  .goal-title { font-weight: 700; color: var(--ink); }
  .goal-status {
    font-size: 8pt; font-weight: 800; color: var(--accent);
    border: 1px solid #DBEAFE; background: var(--accent-soft);
    border-radius: 999px; padding: 1px 8px; margin-left: 6px;
  }
  .goal-desc { font-size: 9.5pt; color: var(--sub); margin-top: 1px; }

  /* ── 마무리 ── */
  .closing {
    margin: 14mm 18mm 0; padding: 10mm;
    background: var(--ink); border-radius: 14px; color: #CBD5E1;
    break-inside: avoid;
  }
  .closing-thanks { font-size: 16pt; font-weight: 800; color: #fff; }
  .closing-name { margin-top: 2mm; font-size: 10.5pt; font-weight: 600; color: #E2E8F0; }
  .closing-name span { color: #94A3B8; font-size: 9pt; margin-left: 6px; }
  .closing-contact { display: flex; flex-wrap: wrap; gap: 3mm 9mm; margin-top: 5mm; padding-top: 4mm; border-top: 1px solid #334155; }
  .closing .cv-k { color: #60A5FA; }
  .closing .cv-v { color: #CBD5E1; }
</style>
</head>
<body>
${buildCover(p)}
${body}
${buildClosing(p)}
</body>
</html>`;
}

// ── PDF 렌더 ─────────────────────────────────────────────────────────────

// HTML 문자열 → A4 PDF 버퍼. 포트폴리오·이력서 등 문서 PDF가 공유하는 렌더 엔진.
export async function htmlToPdf(html) {
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    } catch {
      // 폰트 CDN 차단/지연 시 — 시스템 폰트 폴백으로 진행
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20000 });
    }
    // 웹폰트 적용 대기(최대 5초) — 실패해도 PDF 생성은 계속
    await Promise.race([
      page.evaluateHandle('document.fonts.ready'),
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]).catch(() => {});
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function renderPortfolioPdf(portfolio) {
  return htmlToPdf(buildPortfolioHtml(sanitizeArtifactsDeep(portfolio)));
}
