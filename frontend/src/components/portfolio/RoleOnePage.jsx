/**
 * PM·마케터 '핵심 경험 한 장' — 개발자 화면(좌 GitHeroCard + 우 DevImpactSection)과 같은 2열 틀.
 *   좌측 사이드바 = 사람과 역할만: 제목 · 한 문장 요약 · 역할/팀/기간 · 내가 한 일 · 도구 (수치·그래프는 두지 않는다 — 2026-10-20 사용자 요청)
 *   우측 = 직군 임팩트 문서, 수치는 모두 여기서 그래프·도표로
 *     PM     : 의사결정 사슬 중심 — 프로젝트 소개 → 주요 성과(지표 줄 + 이전→이후 비교) → 사용자 플로우(단계마다 그 단계를 바꾼 결정 D번호)
 *              → 기획 의사결정(한 줄 요약 표: 문제 → 채택안 → 결과, 누르면 판단 과정 사슬) → 리서치와 산출물(산출물 카드 = 이름 + 올린 파일·사진·링크) → 회고
 *     마케터 : 퍼널 중심 — 캠페인 소개(규모 지표 줄) → 주요 성과 → 캠페인 구조(+채널 믹스) → 전환 퍼널(단계 사이 전환율·최적화 표시)
 *              → 단계별 최적화(본 것 → 바꾼 것 → 결과 · 광고 소재) → 회고 → 작업물
 * 다이어그램은 개발자 아키텍처(ArchDiagram)와 같은 모양(흰 박스·회색 화살표·첫 박스 남색 테두리)으로 그린다 —
 * 그 컴포넌트는 위→아래 연결용이라 가로 흐름·열 구조는 여기서 작은 SVG로 그린다.
 * 보기/편집 분리: 기본은 빈 칸 없는 완성 화면, '편집'을 누르면 모든 칸이 입력칸이 된다.
 * ⚠ 전역 brand.css가 bg-white + rounded-2xl/3xl 박스에 검은 테두리·그림자를 입히므로 그 조합을 쓰지 않는다.
 */
import { createContext, useContext, useRef, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import AutoText from '../AutoText';
import { parseAmount, periodLength, splitChange } from '../../utils/roleOnePage';
import { roleArtifacts } from '../../utils/roleArtifacts';

const ACCENT = '#002F6C';
const ISSUE = '#b45309';
const t = (v) => String(v ?? '').trim();
const has = (v) => (Array.isArray(v) ? v.length > 0 : t(v) !== '');
const patchAt = (rows, i, changes) => rows.map((r, ri) => (ri === i ? { ...r, ...changes } : r));
// 한국어는 띄어쓰기 단위로 줄바꿈 — 단어 중간에서 끊지 않는다 (긴 영문·URL만 강제 줄바꿈)
const WRAP = { overflowWrap: 'anywhere', wordBreak: 'keep-all' };
/** 문장 단위로 나눈다 — 마침표 뒤 공백·줄바꿈 기준이라 "3.4만" 같은 소수점은 나누지 않는다 */
const sentences = (v) => t(v).replace(/([.!?。])\s+/g, '$1\n').split('\n').map(s => s.trim()).filter(Boolean);
/** 숫자 뒤 단위 — "40시간 이상"→"시간", "25분"→"분". 단위가 다른 두 값은 막대로 비교하지 않는다 */
const unitOf = (v) => ((t(v).match(/\d[\d,.]*\s*(?:억|만|천)?\s*([^\d\s]*)/) || [])[1] || '').replace(/이상|이하|미만|초과|가량|정도/g, '');
// 시간 단위는 초로 맞춰 비교한다 — "40시간 → 25분"도 막대로 그릴 수 있게 (단순 환산, 새 숫자를 만들지 않는다)
const TIME_UNITS = { 초: 1, 분: 60, 시간: 3600, 일: 86400, 주: 604800, 개월: 2592000 };
const measure = (v) => {
  const n = parseAmount(v);
  if (n == null) return null;
  const unit = unitOf(v);
  return TIME_UNITS[unit] ? { n: n * TIME_UNITS[unit], unit: 'time' } : { n, unit };
};
const comparable = (a, b) => { const x = measure(a); const y = measure(b); return !!(x && y && x.unit === y.unit); };

const rowsToLines = (rows = [], keys) => rows.map(r => keys.map(k => t(r?.[k])).join(' | ')).join('\n');
const linesToRows = (value, keys) => String(value || '').split('\n').map(line => line.split('|').map(s => s.trim()))
  .filter(cells => cells.some(Boolean)).map(cells => Object.fromEntries(keys.map((k, i) => [k, cells[i] || ''])));

// 예전 Firebase Storage 주소 — 무료 요금제에서 막혀(402) 열리지 않는다. 지금 업로드는 /api/files(Firestore)로 간다
const LEGACY_STORAGE = /firebasestorage\.googleapis\.com|storage\.googleapis\.com|\.firebasestorage\.app/i;

/** 결과 화면이 넘겨줄 실제 작업물 — 올린 파일(deliverables·pmFiles) + 핵심 경험·본문에 붙인 이미지 */
export function collectRoleArtifacts(sr = {}, cs = {}) {
  const seen = new Set();
  const images = [];
  const files = [];
  const push = (item) => {
    if (!item.url || seen.has(item.url)) return;
    seen.add(item.url);
    (item.image ? images : files).push(item);
  };
  // removable = 산출물로 올린 것(지울 수 있음), 핵심 경험·본문 이미지는 그쪽에서 관리
  roleArtifacts(sr).forEach(f => push({ url: f.url, name: f.name, ext: t(f.ext || (t(f.name).match(/\.([a-z0-9]{2,5})$/i) || [])[1]).toUpperCase(), link: f.kind === 'link', removable: true, deliverable: t(f.deliverable), expired: LEGACY_STORAGE.test(f.url), image: /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(f.url) || /^(png|jpe?g|webp|gif)$/i.test(f.ext || '') }));
  // 핵심 경험·본문 사진은 여기서 지울 수 없으므로 예전 저장소(열리지 않는) 주소는 아예 싣지 않는다
  (cs.keyExps || []).forEach(k => (k.images || []).filter(img => !LEGACY_STORAGE.test(img.url || '')).forEach(img => push({ url: img.url, name: k.title, image: true })));
  (cs.body || []).filter(seg => seg.type === 'image' && !LEGACY_STORAGE.test(seg.content || '')).forEach(seg => push({ url: seg.content, name: '', image: true }));
  return { images, files };
}

/* ════════════ 보기 / 편집 ════════════ */

const EditCtx = createContext(false);
const useEditing = () => useContext(EditCtx);
const EditOnly = ({ children }) => (useEditing() ? children : null);

function Txt({ value, onChange, placeholder, className = '', block = false }) {
  const editing = useEditing();
  if (editing) return <AutoText dense value={value || ''} onChange={onChange} placeholder={placeholder} className={className} />;
  if (!t(value)) return null;
  const Tag = block ? 'p' : 'span';
  return <Tag className={className} style={WRAP}>{value}</Tag>;
}

/** 긴 문단은 앞 문장 몇 개(약 n줄 분량)를 온전히 보여 주고 나머지는 더 보기 — 문장 중간에서 자르지 않는다 */
function Para({ value, onChange, placeholder, lines = 4, className = 'text-[13.5px] leading-[1.75] text-bluewood-600' }) {
  const editing = useEditing();
  const [open, setOpen] = useState(false);
  if (editing) return <AutoText dense value={value || ''} onChange={onChange} placeholder={placeholder} className={className} />;
  if (!t(value)) return null;
  const all = sentences(value);
  let shown = 1;
  for (let used = all[0].length; shown < all.length && used + all[shown].length <= lines * 52; shown += 1) used += all[shown].length;
  const long = shown < all.length;
  return (
    <div>
      <p className={`whitespace-pre-line ${className}`} style={WRAP}>{open || !long ? value : all.slice(0, shown).join(' ')}</p>
      {long && <button type="button" onClick={() => setOpen(o => !o)} className="mt-0.5 text-[12px] text-bluewood-400 hover:text-primary-600 print:hidden">{open ? '접기' : '더 보기'}</button>}
    </div>
  );
}

function AddLink({ onClick, children }) {
  return <EditOnly><button type="button" onClick={onClick} className="block text-[12px] font-semibold text-bluewood-300 hover:text-primary-600 print:hidden">+ {children}</button></EditOnly>;
}

function LinesEditor({ label, hint, rows, keys, onChange }) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-bold text-bluewood-500">{label} <span className="font-normal text-bluewood-300">{hint}</span></span>
      <textarea defaultValue={rowsToLines(rows, keys)} onBlur={(e) => onChange(linesToRows(e.target.value, keys))} rows={Math.max(2, rows.length + 1)} style={{ minHeight: 0 }}
        className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-[12px] leading-[1.6] text-bluewood-700 outline-none focus:border-primary-300" />
    </label>
  );
}

/* ════════════ 좌측 사이드바 — 사람과 역할만 (수치·그래프는 모두 중앙으로) ════════════ */

const MiniLabel = ({ children }) => <p className="mb-2 text-[12px] font-bold text-bluewood-400">{children}</p>;

/** 역할·팀·기간 — 가는 선으로 나눈 이름표 */
function MetaList({ rows }) {
  const shown = rows.filter(([, v]) => t(v));
  if (!shown.length) return null;
  return (
    <dl className="divide-y divide-surface-100 text-[13px]">
      {shown.map(([k, v]) => (
        <div key={k} className="flex gap-3 py-2 first:pt-0">
          <dt className="w-9 flex-shrink-0 text-bluewood-400">{k}</dt>
          <dd className="min-w-0 font-semibold text-bluewood-800" style={WRAP}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Points({ items }) {
  return (
    <ul className="space-y-1.5">
      {items.map((p, i) => (
        <li key={i} className="flex gap-2 text-[12px] leading-[1.5] text-bluewood-600">
          <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: ACCENT }} />
          <span className="min-w-0" style={WRAP}>{p}</span>
        </li>
      ))}
    </ul>
  );
}

const Chips = ({ items }) => (
  <div className="flex flex-wrap gap-1.5">{items.map((x, i) => <span key={i} className="rounded-md bg-surface-100 px-2 py-0.5 text-[12px] font-semibold text-bluewood-600">{x}</span>)}</div>
);

/** 사이드바 공통 틀 — 라벨 + 제목 + 한 문장 요약 + 지표 블록 */
function Sidebar({ title, onTitle, summary, onSummary, children }) {
  const editing = useEditing();
  return (
    <div className="lg:pr-2">
      <p className="mb-3 text-[11.5px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>핵심 경험 리포트</p>
      {editing
        ? <AutoText prose value={title} onChange={onTitle} placeholder="경험 제목" className="text-[22px] font-black leading-[1.22] tracking-tight text-bluewood-900 sm:text-[26px]" />
        : <h1 className="text-[22px] font-black leading-[1.22] tracking-tight text-bluewood-900 sm:text-[26px]" style={WRAP}>{title}</h1>}
      <div className="mt-2"><Para value={summary} onChange={onSummary} placeholder="한 문장 요약 — 무엇을 해서 어떤 결과를 냈는지" lines={3} className="text-[14px] leading-[1.6] text-bluewood-500" /></div>
      <div className="mt-4 space-y-6 border-t border-surface-200 pt-4">{children}</div>
    </div>
  );
}

/* ════════════ 우측 문서 조각 (개발자 DevImpactSection과 같은 톤) ════════════ */

function ImpactHeader({ title, editing, setEditing, page, onAnalyze, analyzing }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-[15px] font-extrabold text-bluewood-900">{title}</h2>
      <div className="flex items-center gap-3 text-[12px] print:hidden">
        {onAnalyze && (
          <button type="button" onClick={onAnalyze} disabled={analyzing} className="inline-flex items-center gap-1 font-semibold text-bluewood-400 hover:text-primary-600 disabled:opacity-50">
            {analyzing && <Loader2 size={12} className="animate-spin" />}{analyzing ? '자료 읽는 중…' : page.analyzed ? '다시 분석' : '자료로 분석'}
          </button>
        )}
        <button type="button" onClick={() => setEditing(e => !e)} className={`font-semibold ${editing ? 'text-primary-600' : 'text-bluewood-400 hover:text-primary-600'}`}>{editing ? '편집 완료' : '편집'}</button>
      </div>
    </div>
  );
}

function Block({ title, note, children, show = true }) {
  const editing = useEditing();
  if (!show && !editing) return null;
  return (
    <section className="mb-9">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-[13.5px] font-extrabold text-bluewood-900">{title}</h3>
        {note && <span className="text-[11.5px] text-bluewood-300">{note}</span>}
      </div>
      {children}
    </section>
  );
}

const DocHead = ({ children }) => <h4 className="mb-1 text-[14px] font-extrabold text-bluewood-900">{children}</h4>;

/** 이전→이후 변화량 — 퍼센트 값은 %p, 2배 이상은 배수, 그 밖은 증감률. 단위가 다르거나 읽을 수 없으면 null (계산만, 새 숫자를 만들지 않는다) */
function changeOf(before, after) {
  if (!comparable(before, after)) return null;
  const b = measure(before).n;
  const a = measure(after).n;
  if (!b || a === b) return null;
  const text = unitOf(after) === '%' ? `${Math.round(Math.abs(a - b) * 10) / 10}%p`
    : a / b >= 2 ? `${Math.round((a / b) * 10) / 10}배` : `${Math.round(Math.abs(a / b - 1) * 100)}%`;
  return { up: a > b, text };
}

/** 변화 표시 — 방향 기호만 강조색, 숫자는 본문색 (오르는 게 좋은 지표인지 모르므로 색으로 좋고 나쁨을 말하지 않는다) */
const Delta = ({ change }) => (change
  ? <span className="font-bold text-bluewood-800"><span style={{ color: ACCENT }}>{change.up ? '▲' : '▼'}</span> {change.text}</span>
  : null);

/** 결과 지표 — 대표 지표(headline)를 맨 앞에, 주요 성과와 값이 겹치면 한 번만 */
function resultItems(page) {
  const h = page.headline || {};
  const rows = [
    ...(t(h.value) ? [{ label: t(h.label) || '대표 성과', value: t(h.value), before: t(h.before), target: t(h.target) }] : []),
    ...(page.outcomes || []).map(splitChange),
  ];
  const seen = new Set();
  return rows.filter(m => t(m.value) && !seen.has(m.value) && seen.add(m.value))
    .map(m => ({ ...m, change: changeOf(m.before, m.value), target: t(m.target) && t(m.target) !== t(m.value) ? t(m.target) : '' }));
}

/** 지표 줄 — 이름 · 큰 숫자 · 변화. 숫자는 본문색(데이터 색을 글자에 입히지 않는다), 칸 사이는 가는 세로선 */
function KpiRow({ items, compact = false }) {
  return (
    <div className="overflow-hidden border-y border-surface-200">
      {/* 칸마다 왼쪽·위 선 — 첫 칸·첫 줄의 선은 -m으로 밖에 숨긴다. 칸 수는 폭에 맞춰 자동 */}
      <div className="-ml-px -mt-px grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 118 : 148}px, 1fr))` }}>
        {items.map((m, i) => {
          // 한 줄의 숫자는 모두 같은 크기 — 가장 긴 값에 맞춘다. 짧은 값은 줄바꿈하지 않는다
          const longest = Math.max(...items.map(x => x.value.length));
          const size = compact
            ? (longest > 9 ? 'text-[16px]' : 'text-[22px]')
            : (longest > 9 ? 'text-[18px]' : longest > 5 ? 'text-[24px]' : 'text-[30px]');
          return (
            <div key={i} className={`min-w-0 border-l border-t border-surface-200 ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}>
              {/* 이름 칸은 두 줄 높이로 고정 — 이름 길이가 달라도 숫자가 같은 높이에 선다 */}
              <p className={`text-[12px] font-semibold leading-snug text-bluewood-500 ${items.some(x => x.label.length > 10) ? 'min-h-[2.75em]' : ''}`} style={WRAP}>{m.label}</p>
              <p className={`mt-1 font-extrabold leading-tight tracking-tight text-bluewood-900 ${size} ${m.value.length <= 12 ? 'whitespace-nowrap' : ''}`} style={WRAP}>{m.value}</p>
              {(m.change || t(m.before) || m.target) && (
                <p className="mt-1.5 text-[12px] leading-snug text-bluewood-400" style={WRAP}>
                  <Delta change={m.change} />{m.change && ' · '}{t(m.before) && `이전 ${m.before}`}{m.target && `${t(m.before) || m.change ? ' · ' : ''}목표 ${m.target}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 이전 → 이후 — 지표마다 한 줄, 같은 줄의 두 점을 잇는 막대(덤벨). 단위가 지표마다 달라 줄마다 0부터 자기 최댓값까지를 쓴다 */
function ChangeChart({ items }) {
  const place = (p) => (p < 14 ? { left: `${p}%` } : p > 86 ? { left: `${p}%`, transform: 'translateX(-100%)' } : { left: `${p}%`, transform: 'translateX(-50%)' });
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-4 text-[11.5px] text-bluewood-400">
        <span className="font-bold text-bluewood-500">이전 → 이후</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#b8c4d4]" />이전</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} />이후</span>
      </div>
      <div className="divide-y divide-surface-100">
        {items.map((m, i) => {
          const b = measure(m.before).n;
          const a = measure(m.value).n;
          const max = Math.max(a, b) * 1.08;
          const pb = (b / max) * 100;
          const pa = (a / max) * 100;
          return (
            <div key={i} className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)_64px] items-center gap-4 py-2.5 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)_72px]" title={`${m.label}: ${m.before} → ${m.value}`}>
              <span className="text-[12.5px] font-semibold leading-snug text-bluewood-700" style={WRAP}>{m.label}</span>
              <div className="relative h-[46px]">
                <span className="absolute inset-x-0 top-1/2 h-px bg-surface-200" />
                <span className="absolute top-1/2 h-[2px] -translate-y-1/2" style={{ left: `${Math.min(pa, pb)}%`, width: `${Math.abs(pa - pb)}%`, background: ACCENT, opacity: 0.45 }} />
                <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#b8c4d4] ring-2 ring-white" style={{ left: `${pb}%` }} />
                <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: `${pa}%`, background: ACCENT }} />
                <span className="absolute top-0 whitespace-nowrap text-[11px] text-bluewood-400" style={place(pb)}>{m.before}</span>
                <span className="absolute bottom-0 whitespace-nowrap text-[11.5px] font-bold text-bluewood-900" style={place(pa)}>{m.value}</span>
              </div>
              <span className="text-right text-[12px]"><Delta change={m.change} /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 주요 성과 — 지표 줄 + 이전→이후 비교. 편집 때는 대표 지표·성과 줄을 같이 고친다 */
function ResultsBoard({ page, onPatch }) {
  const editing = useEditing();
  if (editing) {
    return (
      <div className="space-y-3">
        <div><p className="mb-1 text-[11.5px] font-bold text-bluewood-500">대표 지표</p><HeadlineEditor page={page} onPatch={onPatch} /></div>
        <LinesEditor label="주요 성과" hint="'지표 | 값' (전후는 '55% → 71%')" rows={page.outcomes} keys={['label', 'value']} onChange={(rows) => onPatch({ ...page, outcomes: rows })} />
      </div>
    );
  }
  const items = resultItems(page);
  const changes = items.filter(m => m.change);
  return (
    <>
      <KpiRow items={items} />
      {changes.length > 0 && <ChangeChart items={changes} />}
    </>
  );
}

function Table({ head, rows, widths }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-surface-200">
      <table className="w-full border-collapse text-[12.5px]">
        {widths && <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>}
        <thead className="bg-surface-50"><tr>{head.map((h, i) => <th key={i} className="border-b border-surface-200 px-3 py-2 text-left text-[11.5px] font-bold text-bluewood-400">{h}</th>)}</tr></thead>
        <tbody>{rows.map((cells, ri) => <tr key={ri}>{cells.map((c, ci) => <td key={ci} className="border-b border-surface-100 px-3 py-2 align-top text-bluewood-700">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/* ── 다이어그램 (개발자 아키텍처와 같은 모양) ── */

/** 글자 수 기준 줄바꿈 — 공백에서 끊고, 길면 자른다 (박스 높이를 내용에 맞춰 키우므로 잘림은 아주 긴 글에서만) */
function wrapChars(text, perLine, maxLines) {
  const words = t(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  words.forEach(w => {
    let word = w;
    while (word.length > perLine) { if (cur) { lines.push(cur); cur = ''; } lines.push(word.slice(0, perLine)); word = word.slice(perLine); }
    if (!cur) cur = word;
    else if ((cur + ' ' + word).length <= perLine) cur = `${cur} ${word}`;
    else { lines.push(cur); cur = word; }
  });
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const kept = lines.slice(0, maxLines); kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, perLine - 1)}…`; return kept; }
  return lines;
}

function DiagramFrame({ width, height, children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-200 bg-surface-50/40 p-4 sm:p-5">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width, minWidth: Math.min(width, 520), display: 'block', margin: '0 auto' }}>
        <defs>
          <marker id="role-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" /></marker>
        </defs>
        {children}
      </svg>
    </div>
  );
}

const boxLines = (w, title, desc) => ({
  titleLines: wrapChars(title, Math.floor((w - 20) / 12.5), 3),
  descLines: desc ? wrapChars(desc, Math.floor((w - 20) / 10.5), 6) : [],
});
/** 글 줄 수에 맞춘 박스 높이 — 마지막 줄 기준선 + 여백 */
const boxHeight = (w, title, desc, top) => {
  const { titleLines, descLines } = boxLines(w, title, desc);
  const start = top ? 36 : 24;
  return start + (titleLines.length - 1) * 16 + (descLines.length ? 20 + (descLines.length - 1) * 14 : 0) + 14;
};

/** 박스 하나 — 위 작은 라벨 + 굵은 제목 + 회색 설명 */
function DiagramBox({ x, y, w, h, title, desc, accent, warn, top }) {
  const { titleLines, descLines } = boxLines(w, title, desc);
  const stroke = warn ? '#f0c48a' : accent ? ACCENT : '#cbd5e1';
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="11" fill={warn ? '#fff8ee' : '#ffffff'} stroke={stroke} strokeWidth={accent ? 1.9 : 1.2} />
      {top && <text x={x + 12} y={y + 17} fontSize="10" fontWeight="700" fill={warn ? ISSUE : '#94a3b8'}>{top}</text>}
      {titleLines.map((line, i) => <text key={`t${i}`} x={x + w / 2} y={y + (top ? 36 : 24) + i * 16} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={warn ? ISSUE : '#0f2747'}>{line}</text>)}
      {descLines.map((line, i) => <text key={`d${i}`} x={x + w / 2} y={y + (top ? 36 : 24) + titleLines.length * 16 + 4 + i * 14} textAnchor="middle" fontSize="10.5" fill="#64748b">{line}</text>)}
    </g>
  );
}

/** PM — 사용자 흐름: 가로 단계 + 단계 아래 예외 정책. marks[i] = 그 단계를 바꾼 의사결정 번호들 (박스 오른쪽 위 D1·D2) */
function FlowDiagram({ steps, exceptions, marks = [] }) {
  const W = 132, GAP = 30, PAD = 6, EX_GAP = 36;
  const exOf = (label) => exceptions.filter(e => t(e.step) === t(label));
  const H = Math.max(92, ...steps.map(s => boxHeight(W, s.label, s.desc, true)));
  const EX_H = Math.max(82, ...steps.map(s => exOf(s.label)[0]).filter(Boolean).map(ex => boxHeight(W, ex.label, ex.handling, true)));
  const hasEx = steps.some(s => exOf(s.label).length);
  const width = PAD * 2 + steps.length * W + (steps.length - 1) * GAP;
  const height = PAD * 2 + H + (hasEx ? EX_GAP + EX_H : 0);
  return (
    <DiagramFrame width={width} height={height}>
      {steps.map((s, i) => {
        const x = PAD + i * (W + GAP);
        const ex = exOf(s.label)[0];
        return (
          <g key={i}>
            <DiagramBox x={x} y={PAD} w={W} h={H} top={`${i + 1}`} title={s.label} desc={s.desc} accent={i === 0} />
            {(marks[i] || []).slice(0, 3).map((n, mi, arr) => {
              const bx = x + W - 8 - (arr.length - mi) * 26 + 2;
              return (
                <g key={`m${n}`}>
                  <rect x={bx} y={PAD + 7} width="24" height="15" rx="4" fill={ACCENT} />
                  <text x={bx + 12} y={PAD + 18} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff">D{n}</text>
                </g>
              );
            })}
            {i < steps.length - 1 && <path d={`M ${x + W} ${PAD + H / 2} L ${x + W + GAP} ${PAD + H / 2}`} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#role-arrow)" fill="none" />}
            {ex && (
              <>
                <path d={`M ${x + W / 2} ${PAD + H} L ${x + W / 2} ${PAD + H + EX_GAP}`} stroke="#e7b37a" strokeWidth="1.4" strokeDasharray="4 3" markerEnd="url(#role-arrow)" fill="none" />
                <DiagramBox x={x} y={PAD + H + EX_GAP} w={W} h={EX_H} top="예외" title={ex.label} desc={ex.handling} warn />
              </>
            )}
          </g>
        );
      })}
    </DiagramFrame>
  );
}

/** 마케터 — 캠페인 구조: 타깃 → 메시지 → 채널(여러 개) → 전환 */
function CampaignDiagram({ structure }) {
  const channels = (structure.channels || []).filter(Boolean).slice(0, 5);
  const W = 156, GAP = 44, PAD = 6, CH_H = 40, CH_GAP = 10;
  const BOX_H = Math.max(112, boxHeight(W, structure.target || '—', structure.insight, true),
    boxHeight(W, structure.message ? `“${structure.message}”` : '—', '', true), boxHeight(W, structure.conversion || '—', '', true));
  const count = Math.max(1, channels.length);
  const chStack = count * CH_H + (count - 1) * CH_GAP;
  const height = PAD * 2 + Math.max(BOX_H, chStack);
  const width = PAD * 2 + 4 * W + 3 * GAP;
  const mid = PAD + (height - PAD * 2) / 2;
  const colX = (c) => PAD + c * (W + GAP);
  const boxY = mid - BOX_H / 2;
  const chY = (i) => mid - chStack / 2 + i * (CH_H + CH_GAP);
  const arrow = (x1, y1, x2, y2, key) => <path key={key} d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`} stroke="#94a3b8" strokeWidth="1.4" fill="none" markerEnd="url(#role-arrow)" />;
  return (
    <DiagramFrame width={width} height={height}>
      <DiagramBox x={colX(0)} y={boxY} w={W} h={BOX_H} top="타깃" title={structure.target || '—'} desc={structure.insight} accent />
      <DiagramBox x={colX(1)} y={boxY} w={W} h={BOX_H} top="메시지" title={structure.message ? `“${structure.message}”` : '—'} />
      {arrow(colX(0) + W, mid, colX(1), mid, 'a1')}
      {(channels.length ? channels : ['—']).map((ch, i) => (
        <g key={i}>
          <rect x={colX(2)} y={chY(i)} width={W} height={CH_H} rx="10" fill="#fff" stroke="#cbd5e1" strokeWidth="1.2" />
          <text x={colX(2) + W / 2} y={chY(i) + CH_H / 2 + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#0f2747">{wrapChars(ch, 11, 1)[0]}</text>
          {arrow(colX(1) + W, mid, colX(2), chY(i) + CH_H / 2, `b${i}`)}
          {arrow(colX(2) + W, chY(i) + CH_H / 2, colX(3), mid, `c${i}`)}
        </g>
      ))}
      <DiagramBox x={colX(3)} y={boxY} w={W} h={BOX_H} top="전환" title={structure.conversion || '—'} />
    </DiagramFrame>
  );
}

/* ── 아코디언 행 (개발자 GitProjectRow와 같은 모양) ── */
function ProcessRow({ index, title, line, lineLabel, badges, open, onToggle, children }) {
  return (
    <div className="border-b border-surface-200">
      <button type="button" onClick={onToggle} aria-expanded={open} className="group flex w-full items-center gap-2.5 py-2.5 text-left">
        <span className="flex flex-shrink-0 items-center justify-center rounded text-[11.5px] font-black text-white" style={{ backgroundColor: ACCENT, height: 18, width: 18 }}>{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-extrabold leading-snug text-bluewood-900" style={WRAP}>{title}</p>
          {/* 접힌 줄은 첫 문장을 통째로 — 말줄임으로 자르지 않는다 */}
          {!open && sentences(line)[0] && <p className="mt-0.5 text-[12px] leading-[1.55] text-bluewood-500" style={WRAP}><span className="font-bold" style={{ color: '#314157' }}>{lineLabel} </span>{sentences(line)[0]}</p>}
        </div>
        {!open && badges.length > 0 && (
          <span className="hidden flex-shrink-0 items-center gap-1.5 font-mono text-[11.5px] sm:flex">
            {badges.map(b => <span key={b.label} className="rounded px-1.5 py-0.5 font-semibold" style={b.issue ? { color: ISSUE, backgroundColor: '#fef7ec' } : { color: '#64748b', backgroundColor: '#f1f4f8' }}>{b.label}</span>)}
          </span>
        )}
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-surface-200 bg-white text-bluewood-400 transition-all group-hover:border-primary-300 group-hover:bg-primary-50 group-hover:text-primary-600 print:hidden" style={open ? { transform: 'rotate(180deg)' } : undefined}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </button>
      {open && <div className="space-y-3.5 pb-5 pl-[28px]">{children}</div>}
    </div>
  );
}

/** 행 안의 라벨 + 내용 (개발자 '문제·해결·성과' 줄과 같은 모양) */
function Labeled({ label, color = '#314157', children }) {
  return (
    <div>
      <p className="mb-0.5 text-[11.5px] font-black uppercase tracking-wide" style={{ color }}>{label}</p>
      {children}
    </div>
  );
}

function ResultLine({ result = {}, onChange }) {
  const editing = useEditing();
  const set = (k) => (v) => onChange({ ...result, [k]: v });
  if (editing) {
    return (
      <Labeled label="성과" color={ACCENT}>
        <div className="grid grid-cols-3 gap-2">{[['label', '지표'], ['before', '이전'], ['after', '이후']].map(([k, ph]) => <AutoText key={k} dense value={result[k] || ''} onChange={set(k)} placeholder={ph} className="text-[12.5px] text-bluewood-700" />)}</div>
      </Labeled>
    );
  }
  if (!t(result.after)) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex-shrink-0 text-[11.5px] font-black uppercase tracking-wide" style={{ color: ACCENT }}>성과</span>
      <p className="text-[12.5px] font-bold leading-[1.55] text-bluewood-900">{t(result.label) && `${result.label} `}{t(result.before) && `${result.before} → `}<span style={{ color: ACCENT }}>{result.after}</span></p>
    </div>
  );
}

function IssueTrack({ label, issue = {}, keys, onChange }) {
  const editing = useEditing();
  const set = (k) => (v) => onChange({ ...issue, [k]: v });
  const parts = keys.filter(([k]) => t(issue[k]));
  if (!editing && !parts.length) return null;
  return (
    <Labeled label={label} color={ISSUE}>
      {editing
        ? <div className="grid gap-2 sm:grid-cols-3">{keys.map(([k, l]) => <AutoText key={k} dense value={issue[k] || ''} onChange={set(k)} placeholder={l} className="text-[12.5px] text-bluewood-700" />)}</div>
        : <p className="text-[12.5px] leading-[1.7] text-bluewood-600">{parts.map(([k, l], i) => <span key={k}>{i > 0 && <span className="mx-1.5 text-bluewood-300">→</span>}<span className="font-semibold text-bluewood-400">{l} </span>{issue[k]}</span>)}</p>}
    </Labeled>
  );
}

/** PRD 스펙 — 문서 도구 창 (개발자 코드 창 자리) */
function PrdWindow({ title, spec = {}, onChange }) {
  const editing = useEditing();
  const set = (k) => (v) => onChange({ ...spec, [k]: v });
  const criteria = spec.criteria || [];
  const policies = spec.policies || [];
  return (
    <div className="overflow-hidden rounded-lg border border-surface-200 bg-white">
      <div className="flex items-center gap-2 border-b border-surface-200 bg-surface-50 px-3.5 py-2">
        <FileText size={13} className="text-bluewood-400" />
        <span className="truncate text-[11.5px] font-semibold text-bluewood-500">PRD · {title || '기능 명세'}</span>
      </div>
      <div className="space-y-3 px-4 py-3.5">
        {(t(spec.story) || editing) && (
          <div>
            <p className="mb-1 text-[11px] font-bold text-bluewood-400">사용자 스토리</p>
            <div className="border-l-2 pl-3" style={{ borderColor: ACCENT }}><Txt block value={spec.story} onChange={set('story')} placeholder="사용자로서 ~하고 싶다" className="text-[13px] font-semibold leading-[1.6] text-bluewood-800" /></div>
          </div>
        )}
        {(criteria.length > 0 || editing) && (
          <div>
            <p className="mb-1 text-[11px] font-bold text-bluewood-400">수용 기준</p>
            {editing
              ? <AutoText dense value={criteria.join('\n')} onChange={(v) => set('criteria')(v.split('\n').map(s => s.trim()).filter(Boolean))} placeholder="한 줄에 하나" className="text-[12.5px] text-bluewood-700" />
              : <ul className="space-y-1">{criteria.map((c, i) => <li key={i} className="flex gap-2 text-[12.5px] leading-[1.55] text-bluewood-700"><span className="mt-[3px] flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] border text-[9px] font-black" style={{ borderColor: ACCENT, color: ACCENT }}>✓</span>{c}</li>)}</ul>}
          </div>
        )}
        {(policies.length > 0 || editing) && (
          <div>
            <p className="mb-1 text-[11px] font-bold text-bluewood-400">정책</p>
            {editing
              ? <LinesEditor label="" hint="'조건 | 처리'" rows={policies} keys={['condition', 'rule']} onChange={set('policies')} />
              : <Table head={['조건', '처리']} widths={['42%', 'auto']} rows={policies.map(p => [p.condition, p.rule])} />}
          </div>
        )}
      </div>
    </div>
  );
}

/** 광고 소재 미리보기 (개발자 코드 창 자리) */
function AdPreview({ creative, onChange, onDelete }) {
  const editing = useEditing();
  const set = (k) => (v) => onChange({ ...creative, [k]: v });
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-white" style={{ borderColor: creative.winner ? ACCENT : '#e2e8f0' }}>
      <div className="flex items-center gap-2 border-b border-surface-100 bg-surface-50 px-3 py-1.5 text-[11px] text-bluewood-400">
        <span className="font-bold text-bluewood-600">소재 {creative.variant}</span>{t(creative.format) && <span>· {creative.format}</span>}
        <span className="ml-auto">
          {editing
            ? <button type="button" onClick={() => onChange({ ...creative, winner: !creative.winner })} className="font-semibold underline">{creative.winner ? '채택됨' : '채택으로'}</button>
            : creative.winner && <span className="font-bold" style={{ color: ACCENT }}>채택</span>}
        </span>
      </div>
      <div className="space-y-1 px-4 py-3.5">
        <Txt block value={creative.hook} onChange={set('hook')} placeholder="후킹 문구" className="text-[15px] font-extrabold leading-snug text-bluewood-900" />
        <Txt block value={creative.body} onChange={set('body')} placeholder="본문" className="text-[12.5px] leading-[1.6] text-bluewood-500" />
      </div>
      {(t(creative.cta) || t(creative.metric) || editing) && (
        <div className="flex items-center justify-between gap-2 border-t border-surface-100 px-4 py-2 text-[12px]">
          <Txt value={creative.cta} onChange={set('cta')} placeholder="CTA" className="font-bold text-primary-700" />
          <Txt value={creative.metric} onChange={set('metric')} placeholder="반응 지표" className="font-black tabular-nums text-bluewood-900" />
        </div>
      )}
      <EditOnly><button type="button" onClick={onDelete} className="px-4 pb-2 text-[11.5px] text-bluewood-300 hover:text-red-500">소재 삭제</button></EditOnly>
    </div>
  );
}

function Artifacts({ artifacts }) {
  const { images = [], files = [] } = artifacts || {};
  if (!images.length && !files.length) return null;
  return (
    <Block title="작업물" note={`${images.length + files.length}개`}>
      {images.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {images.slice(0, 6).map((img, i) => (
            <figure key={i} className="min-w-0">
              <a href={img.url} target="_blank" rel="noreferrer"><img src={img.url} alt={img.name || '작업물'} loading="lazy" className="w-full rounded-lg border border-surface-200 bg-surface-50 object-cover" style={{ maxHeight: 320 }} /></a>
              {img.name && <figcaption className="mt-1.5 text-[12px] text-bluewood-400">{img.name}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-lg border border-surface-200 px-3 py-2 text-[12.5px] text-bluewood-700 hover:border-primary-300">
              <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[10.5px] font-bold text-bluewood-500">{f.ext || '파일'}</span><span className="truncate">{f.name}</span>
            </a>
          ))}
        </div>
      )}
    </Block>
  );
}

/** 산출물 이름의 첫 낱말 — 올린 파일 이름과 짝지을 때 쓴다 ("PRD 24쪽" → "prd", "와이어프레임 12화면" → "와이어프레임") */
const keyword = (name) => (t(name).toLowerCase().match(/[a-z가-힣]{2,}/) || [])[0] || '';

/** 파일·사진 올리기 / 링크 붙이기 — 카드 안에서 연다. target = 이 첨부를 붙일 산출물 이름·바꿀 예전 파일 */
function AttachPanel({ actions, target, onPickFile, onDone }) {
  const [link, setLink] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (actions.addLink(link, target)) { setLink(''); onDone(); }
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-surface-100 px-3 py-2.5 text-[12px] print:hidden">
      <button type="button" onClick={() => onPickFile(target)} disabled={actions.uploading} className="inline-flex items-center gap-1 rounded-md bg-surface-100 px-2.5 py-1 font-semibold text-bluewood-600 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-50">
        {actions.uploading ? <><Loader2 size={12} className="animate-spin" />올리는 중…</> : '파일·사진 올리기'}
      </button>
      <form onSubmit={submit} className="flex min-w-[160px] flex-1 items-center gap-1.5">
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="링크 붙이기 (Notion·Figma·Drive)" className="min-w-0 flex-1 border-b border-surface-200 bg-transparent py-0.5 text-[12px] text-bluewood-700 outline-none placeholder:text-bluewood-300 focus:border-primary-300" />
        {t(link) && <button type="submit" className="font-semibold text-primary-600">추가</button>}
      </form>
    </div>
  );
}

/** 산출물 한 줄 카드 — 왼쪽 작은 표지(사진 썸네일·파일 종류·링크·문서 모양) + 이름·분량.
 *  파일이 없거나 예전 저장소라 열리지 않는 카드는 누르면 그 자리에서 올리기 칸이 열린다 */
function ArtifactCard({ title, value, item, actions, onPickFile }) {
  const [attaching, setAttaching] = useState(false);
  const name = title || item?.name || '산출물';
  const opens = item && !item.expired;
  const canAttach = !!actions && !opens;
  const sub = item?.expired
    ? '예전 저장소라 열 수 없어요 · 눌러서 다시 올리기'
    : [t(value), item && title && item.name !== title ? item.name : ''].filter(Boolean).join(' · ') || (canAttach ? '눌러서 파일·링크 붙이기' : '');
  const badge = item?.image && opens
    ? <img src={item.url} alt={name} loading="lazy" className="h-full w-full object-cover object-top" />
    : item
      ? <span className="text-[10.5px] font-black tracking-wide text-bluewood-500">{item.link ? '링크' : (item.ext || '파일').slice(0, 4)}</span>
      : <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-bluewood-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>;
  const inner = (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border bg-surface-50 ${item?.expired ? 'border-dashed border-amber-300' : canAttach ? 'border-dashed border-surface-300' : 'border-surface-200'}`}>{badge}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold leading-snug text-bluewood-900" style={WRAP}>{name}</span>
        {sub && <span className={`mt-0.5 block truncate text-[11.5px] ${item?.expired ? 'text-amber-700' : 'text-bluewood-400'}`}>{sub}</span>}
      </span>
    </div>
  );
  const target = { deliverable: title || item?.deliverable || '', replace: item?.expired ? item.url : '' };
  return (
    <div className="group relative min-w-0 rounded-lg border border-surface-200 bg-white transition-colors hover:border-primary-200">
      {opens
        ? <a href={item.url} target="_blank" rel="noreferrer" className="block">{inner}</a>
        : canAttach
          ? <button type="button" onClick={() => setAttaching(a => !a)} aria-expanded={attaching} className="block w-full text-left">{inner}</button>
          : inner}
      {attaching && canAttach && <AttachPanel actions={actions} target={target} onPickFile={onPickFile} onDone={() => setAttaching(false)} />}
      {item?.removable && actions?.remove && <RemoveButton onClick={() => actions.remove(item.url)} />}
    </div>
  );
}

const RemoveButton = ({ onClick }) => (
  <button type="button" onClick={onClick} aria-label="산출물 빼기" className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[13px] text-bluewood-400 shadow-sm hover:text-red-500 group-hover:flex print:hidden">×</button>
);

/** 기획 산출물 — 산출물 이름(분석)과 올린 파일·링크를 한 줄 카드로.
 *  짝짓기: 그 산출물 카드에서 직접 붙인 것(deliverable) → 이름의 첫 낱말이 파일명에 들어간 것.
 *  어느 산출물과도 짝이 없는 사진은 아래에 같은 비율의 사진 줄로 모은다 */
function DeliverableBoard({ deliverables, artifacts, actions }) {
  const [link, setLink] = useState('');
  const fileRef = useRef(null);
  const pending = useRef({}); // 파일 선택창을 연 카드 — 고른 파일을 그 산출물에 붙인다
  const items = [...(artifacts?.files || []), ...(artifacts?.images || [])];
  const used = new Set();
  const take = (pred) => { const x = items.find(i => !used.has(i.url) && pred(i)); if (x) used.add(x.url); return x || null; };
  const cards = deliverables.map(d => {
    const k = keyword(d.name);
    const item = take(x => x.deliverable && x.deliverable === t(d.name)) || (k ? take(x => !x.deliverable && t(x.name).toLowerCase().includes(k)) : null);
    return { title: d.name, value: d.value, item };
  });
  const rest = items.filter(x => !used.has(x.url));
  rest.filter(x => !x.image || x.expired).forEach(item => cards.push({ title: '', value: '', item }));
  const photos = rest.filter(x => x.image && !x.expired);
  const pickFile = (target = {}) => { pending.current = target; fileRef.current?.click(); };
  const submitLink = (e) => {
    e.preventDefault();
    if (actions?.addLink(link)) setLink('');
  };
  return (
    <div>
      {cards.length > 0 && (
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c, i) => <ArtifactCard key={c.item?.url || `d${i}`} {...c} actions={actions} onPickFile={pickFile} />)}
        </div>
      )}
      {photos.length > 0 && (
        <div className={`grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5 ${cards.length ? 'mt-3' : ''}`}>
          {photos.map(p => (
            <figure key={p.url} className="group relative min-w-0">
              <a href={p.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-surface-200 bg-surface-50" style={{ aspectRatio: '4 / 3' }}>
                <img src={p.url} alt={p.name || '산출물 사진'} loading="lazy" className="h-full w-full object-cover object-top transition-opacity hover:opacity-90" />
              </a>
              {t(p.name) && <figcaption className="mt-1 truncate text-[11.5px] text-bluewood-400">{p.name}</figcaption>}
              {p.removable && actions?.remove && <RemoveButton onClick={() => actions.remove(p.url)} />}
            </figure>
          ))}
        </div>
      )}
      {actions && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] print:hidden">
          <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.ppt,.pptx,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.csv,.key,.fig,.zip,.png,.jpg,.jpeg,.webp,.gif"
            onChange={(e) => { const picked = Array.from(e.target.files || []); e.target.value = ''; if (picked.length) actions.addFiles(picked, pending.current); pending.current = {}; }} />
          <button type="button" onClick={() => pickFile()} disabled={actions.uploading} className="inline-flex items-center gap-1 font-semibold text-bluewood-400 hover:text-primary-600 disabled:opacity-50">
            {actions.uploading ? <><Loader2 size={12} className="animate-spin" />올리는 중…</> : '+ 파일·사진 올리기'}
          </button>
          <form onSubmit={submitLink} className="flex min-w-0 flex-1 items-center gap-1.5 sm:max-w-[320px]">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="+ 링크 (Notion·Figma·Drive)" className="min-w-0 flex-1 border-b border-surface-200 bg-transparent py-0.5 text-[12px] text-bluewood-700 outline-none placeholder:text-bluewood-300 focus:border-primary-300" />
            {t(link) && <button type="submit" className="font-semibold text-primary-600">추가</button>}
          </form>
        </div>
      )}
      {!cards.length && !photos.length && <p className="mt-1.5 text-[12px] text-bluewood-300 print:hidden">PRD·와이어프레임·정책서 같은 기획 문서를 올리면 여기에 함께 보여요.</p>}
    </div>
  );
}

function Learnings({ items, retrospective, onRetro, placeholder }) {
  const editing = useEditing();
  const rows = [...new Set(items.map(t).filter(x => x && x !== t(retrospective)))];
  if (!editing && !t(retrospective) && !rows.length) return null;
  return (
    <Block title="회고">
      <Para value={retrospective} onChange={onRetro} placeholder={placeholder} lines={3} />
      {!editing && rows.length > 0 && <div className="mt-2"><Points items={rows} /></div>}
    </Block>
  );
}

const hasIssue = (x = {}) => Object.values(x).some(has);
const hasSpec = (s = {}) => has(s.story) || has(s.criteria) || has(s.policies);

function HeadlineEditor({ page, onPatch }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[['label', '대표 지표'], ['value', '실측값'], ['before', '이전'], ['target', '목표']].map(([k, ph]) => (
        <AutoText key={k} value={page.headline[k] || ''} onChange={(v) => onPatch({ ...page, headline: { ...page.headline, [k]: v } })} placeholder={ph} className="text-[12px] text-bluewood-700" />
      ))}
    </div>
  );
}

function ThinNote({ show, onAnalyze, analyzing, what }) {
  if (!show || !onAnalyze) return null;
  return (
    <div className="mb-7 rounded-xl border border-dashed border-surface-300 px-4 py-3.5 text-[13px] leading-[1.65] text-bluewood-500 print:hidden">
      아직 {what}이 충분히 정리되지 않았어요. 올린 자료를 다시 읽어 채울 수 있어요(자료에 없는 숫자는 만들지 않아요).
      <button type="button" onClick={onAnalyze} disabled={analyzing} className="ml-1.5 font-bold text-primary-600 hover:underline disabled:opacity-50">{analyzing ? '자료 읽는 중…' : '자료로 분석하기'}</button>
    </div>
  );
}

/* ════════════ 기획/PM ════════════ */

const EMPTY_DECISION = { title: '', step: '', tags: [], problem: '', evidence: '', options: [], result: { label: '', before: '', after: '' }, spec: { story: '', criteria: [], policies: [] }, issue: { signal: '', cause: '', fix: '' }, learning: '' };

/** 결정이 바꾼 플로우 단계 번호 — 분석이 준 step이 있으면 그것, 없으면 결정 글에 단계명이 나오는지로 읽는다 (못 찾으면 -1) */
function stepIndexOf(d = {}, flow = []) {
  const named = flow.findIndex(s => t(s.label) && t(s.label) === t(d.step));
  if (named >= 0) return named;
  const body = [d.title, d.problem, ...(d.options || []).filter(o => o.chosen).map(o => o.label), d.spec?.story].map(t).join(' ');
  return flow.findIndex(s => t(s.label).length >= 2 && body.includes(t(s.label)));
}

const chosenOf = (d = {}) => (d.options || []).find(o => o.chosen)?.label || '';
const resultText = (r = {}) => (t(r.after) ? `${t(r.label) ? `${r.label} ` : ''}${t(r.before) ? `${r.before} → ` : ''}${r.after}` : '');
// 요약 표 칸 — 큰 화면은 D# · 문제 · 채택안 · 결과 · 펼침 단추, 작은 화면은 세로로 쌓는다
const DECISION_COLS = 'sm:grid-cols-[52px_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.8fr)_28px]';

/** 판단 과정 한 단계 — 왼쪽 단계 이름, 오른쪽 내용, 단계 사이 세로선 (위에서 아래로 읽는 사슬) */
function ChainStep({ label, color = '#314157', last, children }) {
  return (
    <li className="relative grid grid-cols-1 gap-x-4 gap-y-1 pb-4 pl-5 sm:grid-cols-[112px_minmax(0,1fr)]">
      {!last && <span className="absolute bottom-0 left-[4px] top-[14px] w-px bg-surface-200" />}
      <span className="absolute left-0 top-[5px] h-[9px] w-[9px] rounded-full border-2 bg-white" style={{ borderColor: color }} />
      <span className="text-[12px] font-bold leading-[1.5]" style={{ color }}>{label}</span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

/** 의사결정 펼침 — 이 결정을 어떻게 내렸나: 왜 필요했나 → 뺀 대안 → 고른 안과 이유 → 기획서에 옮긴 것 → 결과와 대응 → 배운 점 */
function DecisionDetail({ d, set, onDelete }) {
  const editing = useEditing();
  const options = d.options || [];
  const chosen = options.filter(o => o.chosen);
  const rejected = options.filter(o => !o.chosen);
  const body = 'text-[12.5px] leading-[1.7] text-bluewood-700';
  const steps = editing ? [
    { label: '왜 필요했나', node: <div className="space-y-2"><Para value={d.problem} onChange={set('problem')} placeholder="왜 이 결정이 필요했나" className={body} /><Para value={d.evidence} onChange={set('evidence')} placeholder="판단 근거 — 인터뷰 발화·데이터" className={body} /></div> },
    { label: '검토한 안', color: ACCENT, node: <LinesEditor label="" hint="'검토안 | 채택 또는 제외 | 이유'" rows={options.map(o => ({ ...o, chosen: o.chosen ? '채택' : '제외' }))} keys={['label', 'chosen', 'reason']} onChange={(rows) => set('options')(rows.map(r => ({ label: r.label, chosen: r.chosen === '채택', reason: r.reason })))} /> },
    { label: '기획서에 옮긴 것', node: <PrdWindow title={d.title} spec={d.spec} onChange={set('spec')} /> },
    { label: '결과와 대응', color: ACCENT, node: <div className="space-y-2"><ResultLine result={d.result} onChange={set('result')} /><IssueTrack label="출시 후 드러난 문제" issue={d.issue} onChange={set('issue')} keys={[['signal', '발견'], ['cause', '원인'], ['fix', '대응']]} /></div> },
    { label: '배운 점', color: '#94a3b8', node: <Txt block value={d.learning} onChange={set('learning')} placeholder="이 결정으로 배운 점" className={body} /> },
  ] : [
    (t(d.problem) || t(d.evidence)) && { label: '왜 필요했나', node: (
      <div className="space-y-1.5">
        <Para value={d.problem} lines={3} className={body} />
        {t(d.evidence) && <p className="border-l-2 border-surface-300 pl-3 text-[12.5px] leading-[1.65] text-bluewood-500" style={WRAP}><span className="mr-1.5 font-bold not-italic text-bluewood-400">근거</span>{d.evidence}</p>}
      </div>
    ) },
    rejected.length > 0 && { label: '검토했지만 뺀 안', node: (
      <ul className="space-y-1">{rejected.map((o, oi) => (
        <li key={oi} className="text-[12.5px] leading-[1.6] text-bluewood-500" style={WRAP}><span className="mr-1.5 text-bluewood-300">✕</span><span className="text-bluewood-600 line-through decoration-bluewood-300">{o.label}</span>{t(o.reason) && <span> — {o.reason}</span>}</li>
      ))}</ul>
    ) },
    chosen.length > 0 && { label: '고른 안과 이유', color: ACCENT, node: (
      <ul className="space-y-1">{chosen.map((o, oi) => (
        <li key={oi} className="text-[13px] leading-[1.6] text-bluewood-800" style={WRAP}><span className="mr-1.5 font-black" style={{ color: ACCENT }}>✓</span><b>{o.label}</b>{t(o.reason) && <span className="font-normal text-bluewood-600"> — {o.reason}</span>}</li>
      ))}</ul>
    ) },
    hasSpec(d.spec) && { label: '기획서에 옮긴 것', node: <PrdWindow title={d.title} spec={d.spec} onChange={set('spec')} /> },
    (t(d.result?.after) || hasIssue(d.issue)) && { label: '결과와 대응', color: ACCENT, node: (
      <div className="space-y-2">
        <ResultLine result={d.result} onChange={set('result')} />
        <IssueTrack label="출시 후 드러난 문제" issue={d.issue} onChange={set('issue')} keys={[['signal', '발견'], ['cause', '원인'], ['fix', '대응']]} />
      </div>
    ) },
    t(d.learning) && { label: '배운 점', color: '#94a3b8', node: <p className={body} style={WRAP}>{d.learning}</p> },
  ].filter(Boolean);
  return (
    <div className="pb-5 sm:pl-[68px]">
      <EditOnly>
        <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
          <AutoText value={d.title} onChange={set('title')} placeholder="의사결정 제목" className="text-[14px] font-extrabold text-bluewood-900" />
          <AutoText value={d.step || ''} onChange={set('step')} placeholder="바꾼 플로우 단계명" className="text-[12.5px] text-bluewood-700" />
        </div>
      </EditOnly>
      <ol>{steps.map((s, si) => <ChainStep key={s.label} label={s.label} color={s.color} last={si === steps.length - 1}>{s.node}</ChainStep>)}</ol>
      <EditOnly><button type="button" onClick={onDelete} className="text-[11.5px] text-bluewood-300 hover:text-red-500">이 의사결정 삭제</button></EditOnly>
    </div>
  );
}

/** 의사결정 — 펼치지 않아도 한 줄에 문제 → 채택안 → 결과, 누르면 이 결정을 내린 과정 */
function DecisionRows({ page, onPatch }) {
  const editing = useEditing();
  const [open, setOpen] = useState([]);
  const decisions = page.decisions;
  const setDecision = (i, changes) => onPatch({ ...page, decisions: patchAt(decisions, i, changes) });
  const toggle = (i) => setOpen(prev => (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]));
  return (
    <>
      <div className={`hidden gap-4 border-b border-surface-200 pb-2 text-[11.5px] font-bold text-bluewood-400 sm:grid ${DECISION_COLS}`}>
        <span>결정</span><span>문제</span><span>채택안</span><span>결과</span><span />
      </div>
      {decisions.map((d, i) => {
        const options = d.options || [];
        const set = (k) => (v) => setDecision(i, { [k]: v });
        const isOpen = open.includes(i) || editing;
        const step = stepIndexOf(d, page.flow);
        const extras = [...(options.length > 1 ? [`검토안 ${options.length}`] : []), ...(hasSpec(d.spec) ? ['PRD'] : []), ...(hasIssue(d.issue) ? ['이슈 대응'] : [])];
        return (
          <div key={i} className="border-b border-surface-200">
            <button type="button" onClick={() => toggle(i)} aria-expanded={isOpen} className={`group grid w-full grid-cols-1 gap-x-4 gap-y-1.5 py-3.5 text-left ${DECISION_COLS}`}>
              <span className="flex items-center gap-2 sm:block">
                <span className="inline-flex h-[20px] items-center rounded px-1.5 text-[11.5px] font-black text-white" style={{ backgroundColor: ACCENT }}>D{i + 1}</span>
                {step >= 0 && <span className="text-[11px] font-semibold text-bluewood-400 sm:mt-1 sm:block" style={WRAP}>{step + 1}. {page.flow[step].label}</span>}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-extrabold leading-snug text-bluewood-900" style={WRAP}>{d.title || `의사결정 ${i + 1}`}</span>
                {sentences(d.problem)[0] && <span className="mt-0.5 block text-[12.5px] leading-[1.55] text-bluewood-500" style={WRAP}>{sentences(d.problem)[0]}</span>}
              </span>
              <span className="min-w-0 text-[13px] font-semibold leading-[1.55] text-bluewood-800" style={WRAP}>
                <span className="mr-1.5 text-[11px] font-bold text-bluewood-400 sm:hidden">채택</span>{chosenOf(d) || <span className="text-bluewood-300">—</span>}
              </span>
              <span className="min-w-0 text-[13px] font-bold leading-[1.55]" style={{ ...WRAP, color: ACCENT }}>
                <span className="mr-1.5 text-[11px] font-bold text-bluewood-400 sm:hidden">결과</span>{resultText(d.result) || <span className="font-normal text-bluewood-300">—</span>}
              </span>
              <span className="hidden h-7 w-7 items-center justify-center rounded-full border border-surface-200 bg-white text-bluewood-400 transition-all group-hover:border-primary-300 group-hover:text-primary-600 sm:flex print:hidden" style={isOpen ? { transform: 'rotate(180deg)' } : undefined}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </span>
              {!isOpen && extras.length > 0 && <span className="text-[11.5px] text-bluewood-400 sm:col-start-2 sm:col-end-5">판단 과정 보기 · {extras.join(' · ')}</span>}
            </button>
            {isOpen && (
              <DecisionDetail d={d} set={set} onDelete={() => onPatch({ ...page, decisions: decisions.filter((_, di) => di !== i) })} />
            )}
          </div>
        );
      })}
      <div className="mt-2"><AddLink onClick={() => { onPatch({ ...page, decisions: [...decisions, EMPTY_DECISION] }); setOpen(prev => [...prev, decisions.length]); }}>의사결정 추가</AddLink></div>
    </>
  );
}

export function PmOnePager({ title, onTitle, meta = {}, page, onPatch, onAnalyze, analyzing, artifacts, artifactActions }) {
  const [editing, setEditing] = useState(false);
  const set = (k) => (v) => onPatch({ ...page, [k]: v });
  const thin = !t(page.headline.value) && !page.decisions.length;
  const results = resultItems(page);
  const research = page.research.filter(r => t(r.value));
  const flowMarks = page.flow.map((_, si) => page.decisions.map((d, di) => (stepIndexOf(d, page.flow) === si ? di + 1 : 0)).filter(Boolean));
  return (
    <EditCtx.Provider value={editing}>
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-10">
        <Sidebar title={title} onTitle={onTitle} summary={page.summary} onSummary={set('summary')}>
          {editing
            ? <div className="grid grid-cols-2 gap-2"><AutoText value={page.role} onChange={set('role')} placeholder="역할" className="text-[12px] text-bluewood-700" /><AutoText value={page.team} onChange={set('team')} placeholder="팀" className="text-[12px] text-bluewood-700" /></div>
            : <MetaList rows={[['역할', page.role], ['팀', page.team], ['기간', meta.duration]]} />}
          {(page.contribution.length > 0 || editing) && <div><MiniLabel>내가 한 일</MiniLabel>{editing ? <AutoText dense value={page.contribution.join('\n')} onChange={(v) => set('contribution')(v.split('\n').map(s => s.trim()).filter(Boolean))} placeholder="한 줄에 하나" className="text-[12.5px] text-bluewood-700" /> : <Points items={page.contribution} />}</div>}
          {(page.tools.length > 0 || editing) && <div><MiniLabel>기획 도구</MiniLabel>{editing ? <AutoText dense value={page.tools.join(', ')} onChange={(v) => set('tools')(v.split(',').map(s => s.trim()).filter(Boolean))} placeholder="쉼표로 구분" className="text-[12.5px] text-bluewood-700" /> : <Chips items={page.tools} />}</div>}
        </Sidebar>

        <section className="min-w-0">
          <ImpactHeader title="기획 임팩트" editing={editing} setEditing={setEditing} page={page} onAnalyze={onAnalyze} analyzing={analyzing} />
          <ThinNote show={thin} onAnalyze={onAnalyze} analyzing={analyzing} what="성과와 의사결정" />
          <Block title="프로젝트 소개" show={has(page.problem) || has(page.solution) || has(page.goal)}>
            <div className="space-y-4">
              {(t(page.problem) || editing) && <div><DocHead>문제 정의</DocHead><Para value={page.problem} onChange={set('problem')} placeholder="누가 어떤 상황에서 어떤 불편을 겪었나" /></div>}
              {(t(page.goal) || editing) && <div><DocHead>목표</DocHead><Para value={page.goal} onChange={set('goal')} placeholder="시작할 때 정한 목표·성공 기준" lines={2} /></div>}
              {(t(page.solution) || editing) && <div><DocHead>해결 방법</DocHead><Para value={page.solution} onChange={set('solution')} placeholder="어떤 제품 방식으로 풀었나" /></div>}
            </div>
          </Block>
          <Block title="주요 성과" note={results.length ? `${results.length}개 지표` : ''} show={results.length > 0}>
            <ResultsBoard page={page} onPatch={onPatch} />
          </Block>
          <Block title="사용자 플로우" note={flowMarks.some(m => m.length) ? 'D = 그 단계를 바꾼 의사결정' : page.exceptions.length ? `예외 정책 ${page.exceptions.length}건` : '서비스 흐름'} show={page.flow.length > 0}>
            {editing
              ? <div className="space-y-2"><LinesEditor label="단계" hint="'단계 | 사용자가 하는 일'" rows={page.flow} keys={['label', 'desc']} onChange={set('flow')} /><LinesEditor label="예외 정책" hint="'단계 | 예외 상황 | 처리'" rows={page.exceptions} keys={['step', 'label', 'handling']} onChange={set('exceptions')} /></div>
              : <FlowDiagram steps={page.flow} exceptions={page.exceptions} marks={flowMarks} />}
          </Block>
          <Block title="기획 의사결정" note={`${page.decisions.length}건 · 문제 → 채택안 → 결과`} show={page.decisions.length > 0}>
            <DecisionRows page={page} onPatch={onPatch} />
          </Block>
          <Block title="리서치와 산출물" note="판단의 근거와 직접 만든 문서">
            <div className="space-y-5">
              {editing
                ? <LinesEditor label="리서치 규모" hint="'조사 | 규모'" rows={page.research} keys={['label', 'value']} onChange={set('research')} />
                : research.length > 0 && <div><MiniLabel>리서치 규모</MiniLabel><KpiRow compact items={research.map(r => ({ label: r.label, value: r.value }))} /></div>}
              <div>
                <MiniLabel>기획 산출물</MiniLabel>
                {editing && <div className="mb-3"><LinesEditor label="" hint="'산출물 | 분량' — 올린 파일 이름이 같은 낱말로 시작하면 한 카드로 묶여요" rows={page.deliverables} keys={['name', 'value']} onChange={set('deliverables')} /></div>}
                <DeliverableBoard deliverables={page.deliverables} artifacts={artifacts} actions={artifactActions} />
              </div>
            </div>
          </Block>
          <Learnings items={page.decisions.map(d => d.learning)} retrospective={page.retrospective} onRetro={set('retrospective')} placeholder="다음에 다르게 할 점·배운 점" />
        </section>
      </div>
    </EditCtx.Provider>
  );
}

/* ════════════ 마케터 — 퍼널 중심: 캠페인 구조 → 전환 퍼널 → 단계별 최적화 ════════════ */

const EMPTY_EXECUTION = { title: '', stage: '', tags: [], insight: '', action: '', result: { label: '', before: '', after: '' }, creatives: [], issue: { signal: '', diagnosis: '', fix: '' }, learning: '' };
const nextVariant = (creatives) => String.fromCharCode(65 + creatives.length);

// 채널 비중 막대 — 검증된 범주형 팔레트를 정해진 순서대로 (색은 채널을 따라간다, 순위가 아니라)
const CHANNEL_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];

/** 퍼널 단계 — 결과 지표 이름·태그·제목으로 그 실행이 움직인 단계를 읽는다 (분석 결과에 stage가 있으면 그것) */
const STAGES = [
  ['노출', /노출|도달|임프레션|impression|cpm|조회|팔로워|인지/i],
  ['클릭', /클릭|ctr|유입|방문|트래픽|세션/i],
  ['전환', /전환|cvr|구매|결제|가입|신청|매출|roas|cpa|주문|다운로드|예약/i],
];
const stageGroup = (text) => STAGES.find(([, re]) => re.test(text || ''))?.[0] || '';
const stageOf = (x = {}) => stageGroup(t(x.stage)) || t(x.stage) || stageGroup([x.result?.label, ...(x.tags || []), x.title].join(' '));
const rateText = (r) => `${r < 1 ? r.toFixed(2) : r.toFixed(1)}%`;

/** 전환 퍼널 — 단계 값, 다음 단계로의 전환율, 그 단계를 움직인 최적화 번호 */
function FunnelSteps({ funnel, executions }) {
  const rows = funnel.map(f => ({ ...f, n: parseAmount(f.value), group: stageGroup(f.label) }));
  const tagged = executions.map((x, i) => ({ i, stage: stageOf(x), title: t(x.title) || `최적화 ${i + 1}` }));
  return (
    <ol>
      {rows.map((r, i) => {
        const next = rows[i + 1];
        const rate = next && r.n && next.n ? (next.n / r.n) * 100 : null;
        const marks = r.group ? tagged.filter(x => x.stage === r.group) : [];
        return (
          <li key={i} className="relative pl-8">
            {next && <span className="absolute bottom-0 left-[8px] top-[30px] w-[2px] bg-[#d5dde8]" />}
            <span className="absolute left-0 top-[14px] h-[18px] w-[18px] rounded-full border-[3px] bg-white" style={{ borderColor: ACCENT }} />
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 py-2">
              <span className="w-[72px] text-[13px] font-bold text-bluewood-600" style={WRAP}>{r.label}</span>
              <span className="text-[26px] font-extrabold leading-tight tracking-tight text-bluewood-900">{r.value}</span>
              {marks.length > 0 && (
                <span className="flex flex-wrap gap-1.5 sm:ml-auto">
                  {marks.map(m => <span key={m.i} className="rounded-md bg-surface-100 px-2 py-0.5 text-[11.5px] font-semibold text-bluewood-600" style={WRAP}>최적화 {m.i + 1} · {m.title}</span>)}
                </span>
              )}
            </div>
            {next && <p className="pb-3 text-[12.5px] text-bluewood-500">↓ {rate != null ? <><b className="text-bluewood-900">{rateText(rate)}</b>가 {next.label}(으)로</> : `${next.label}(으)로`}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/** 채널 믹스 — 한 줄 누적 막대(조각 사이 2px 틈) + 범례에 이름·비중 */
function ChannelBar({ channels }) {
  const shared = channels.filter(c => c.share > 0);
  return (
    <div>
      <div className="flex h-[18px] w-full gap-[2px]">
        {shared.map((c, i) => (
          <div key={c.name} title={`${c.name} ${c.share}%`} className={`h-full ${i === 0 ? 'rounded-l-[4px]' : ''} ${i === shared.length - 1 ? 'rounded-r-[4px]' : ''}`}
            style={{ flexGrow: c.share, flexBasis: 0, background: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {shared.map((c, i) => (
          <li key={c.name} className="flex items-center gap-2 text-[12.5px] text-bluewood-700">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }} />{c.name}<b className="tabular-nums text-bluewood-900">{c.share}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 단계별 최적화 — 무엇을 보고(본 것) 무엇을 바꿨고(바꾼 것) 숫자가 어떻게 됐나(결과) */
function OptimizationRows({ page, onPatch }) {
  const editing = useEditing();
  const [open, setOpen] = useState([0]);
  const xs = page.executions;
  const setExecution = (i, changes) => onPatch({ ...page, executions: patchAt(xs, i, changes) });
  const toggle = (i) => setOpen(prev => (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]));
  return (
    <>
      {xs.map((x, i) => {
        const set = (k) => (v) => setExecution(i, { [k]: v });
        const creatives = x.creatives || [];
        const stage = stageOf(x);
        return (
          <ProcessRow key={i} index={i} title={x.title || `최적화 ${i + 1}`} line={t(x.insight)} lineLabel="본 것" open={open.includes(i)} onToggle={() => toggle(i)}
            badges={[...(stage ? [{ label: stage }] : []), ...(creatives.length ? [{ label: `소재 ${creatives.length}` }] : []), ...(t(x.result?.after) && t(x.result.after).length <= 10 ? [{ label: x.result.after }] : [])]}>
            <EditOnly>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
                <AutoText value={x.title} onChange={set('title')} placeholder="최적화 제목" className="text-[14px] font-extrabold text-bluewood-900" />
                <AutoText value={x.stage || ''} onChange={set('stage')} placeholder="퍼널 단계 (노출·클릭·전환)" className="text-[12.5px] text-bluewood-700" />
              </div>
            </EditOnly>
            {(t(x.insight) || editing) && <Labeled label="본 것"><Para value={x.insight} onChange={set('insight')} lines={2} placeholder="어떤 숫자·반응을 보고 바꾸기로 했나" className="text-[12.5px] leading-[1.7] text-bluewood-700" /></Labeled>}
            {(t(x.action) || editing) && <Labeled label="바꾼 것" color={ACCENT}><Para value={x.action} onChange={set('action')} lines={3} placeholder="소재·타깃·입찰·랜딩 중 무엇을 어떻게 바꿨나" className="text-[12.5px] leading-[1.7] text-bluewood-700" /></Labeled>}
            <ResultLine result={x.result} onChange={set('result')} />
            {(creatives.length > 0 || editing) && (
              <Labeled label="광고 소재">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {creatives.map((c, ci) => <AdPreview key={ci} creative={c} onChange={(v) => set('creatives')(patchAt(creatives, ci, v))} onDelete={() => set('creatives')(creatives.filter((_, cj) => cj !== ci))} />)}
                </div>
                {creatives.length < 3 && <div className="mt-1.5"><AddLink onClick={() => set('creatives')([...creatives, { variant: nextVariant(creatives), format: '', hook: '', body: '', cta: '', metric: '', winner: false }])}>소재 카피</AddLink></div>}
              </Labeled>
            )}
            <IssueTrack label="성과 대응" issue={x.issue} onChange={set('issue')} keys={[['signal', '신호'], ['diagnosis', '진단'], ['fix', '조치']]} />
            {(t(x.learning) || editing) && <Labeled label="배운 점" color="#94a3b8"><Txt block value={x.learning} onChange={set('learning')} placeholder="다음 캠페인에 가져갈 점" className="text-[12.5px] leading-[1.65] text-bluewood-600" /></Labeled>}
            <EditOnly><button type="button" onClick={() => onPatch({ ...page, executions: xs.filter((_, xi) => xi !== i) })} className="text-[11.5px] text-bluewood-300 hover:text-red-500">이 최적화 삭제</button></EditOnly>
          </ProcessRow>
        );
      })}
      <div className="mt-2"><AddLink onClick={() => { onPatch({ ...page, executions: [...xs, EMPTY_EXECUTION] }); setOpen(prev => [...prev, xs.length]); }}>최적화 추가</AddLink></div>
    </>
  );
}

export function CampaignOnePager({ title, onTitle, meta = {}, page, onPatch, onAnalyze, analyzing, artifacts }) {
  const [editing, setEditing] = useState(false);
  const set = (k) => (v) => onPatch({ ...page, [k]: v });
  const st = page.structure || {};
  const setSt = (k) => (v) => onPatch({ ...page, structure: { ...st, [k]: v } });
  const rawPeriod = meta.duration || page.stats.find(s => s.label === '기간')?.value;
  const results = resultItems(page);
  // 캠페인 규모 — 예산·기간·채널 수처럼 예전에 좌측에 있던 숫자를 소개 위 지표 줄로.
  // 매출·비중·전환율 같은 결과 숫자는 '주요 성과'에 있으므로 여기서는 뺀다 (분석이 규모 칸에 결과를 넣는 경우가 있다)
  const resultValues = new Set(results.map(m => m.value));
  const overview = [
    ...page.stats.filter(s => s.label !== '기간' && t(s.value) && !resultValues.has(t(s.value)) && !/매출|roas|cvr|ctr|cpa|전환|비중|구매/i.test(s.label)),
    ...(rawPeriod ? [{ label: '기간', value: periodLength(rawPeriod) }] : []),
    ...(page.channels.length ? [{ label: '채널', value: `${page.channels.length}개` }] : []),
  ].slice(0, 5);
  const diagramChannels = st.channels?.length ? st.channels : page.channels.map(c => c.name);
  const thin = !t(page.headline.value) && !page.executions.length;
  return (
    <EditCtx.Provider value={editing}>
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-10">
        <Sidebar title={title} onTitle={onTitle} summary={page.summary} onSummary={set('summary')}>
          {editing
            ? <AutoText value={page.role} onChange={set('role')} placeholder="역할" className="text-[12px] text-bluewood-700" />
            : <MetaList rows={[['역할', page.role], ['기간', rawPeriod]]} />}
          {(page.contribution.length > 0 || editing) && <div><MiniLabel>내가 한 일</MiniLabel>{editing ? <AutoText dense value={page.contribution.join('\n')} onChange={(v) => set('contribution')(v.split('\n').map(s => s.trim()).filter(Boolean))} placeholder="한 줄에 하나" className="text-[12.5px] text-bluewood-700" /> : <Points items={page.contribution} />}</div>}
          {(page.tools.length > 0 || editing) && <div><MiniLabel>마케팅 도구</MiniLabel>{editing ? <AutoText dense value={page.tools.join(', ')} onChange={(v) => set('tools')(v.split(',').map(s => s.trim()).filter(Boolean))} placeholder="쉼표로 구분" className="text-[12.5px] text-bluewood-700" /> : <Chips items={page.tools} />}</div>}
        </Sidebar>

        <section className="min-w-0">
          <ImpactHeader title="캠페인 임팩트" editing={editing} setEditing={setEditing} page={page} onAnalyze={onAnalyze} analyzing={analyzing} />
          <ThinNote show={thin} onAnalyze={onAnalyze} analyzing={analyzing} what="캠페인 성과와 최적화" />
          <Block title="캠페인 소개" show={overview.length > 0 || has(page.problem) || has(page.goal) || has(st.message) || has(page.strategy)}>
            {editing
              ? <div className="mb-4"><LinesEditor label="캠페인 규모" hint="'항목 | 값' (예산·기간 등)" rows={page.stats} keys={['label', 'value']} onChange={set('stats')} /></div>
              : overview.length > 0 && <div className="mb-5"><KpiRow compact items={overview} /></div>}
            <div className="space-y-4">
              {(t(page.problem) || editing) && <div><DocHead>캠페인 과제</DocHead><Para value={page.problem} onChange={set('problem')} placeholder="이 캠페인이 풀어야 했던 과제" /></div>}
              {(t(page.goal) || editing) && <div><DocHead>목표</DocHead><Para value={page.goal} onChange={set('goal')} placeholder="목표·성공 기준" lines={2} /></div>}
              {(t(st.message) || editing) && (
                <div><DocHead>핵심 메시지</DocHead>
                  <div className="border-l-2 pl-3.5" style={{ borderColor: ACCENT }}><Txt block value={st.message} onChange={setSt('message')} placeholder="고객에게 전한 한 문장" className="text-[17px] font-extrabold leading-[1.45] text-bluewood-900" /></div>
                </div>
              )}
              {(t(page.strategy) || editing) && <div><DocHead>전략</DocHead><Para value={page.strategy} onChange={set('strategy')} placeholder="타깃·메시지·채널을 어떻게 잡았나" lines={3} /></div>}
            </div>
          </Block>
          <Block title="주요 성과" note={results.length ? `${results.length}개 지표` : ''} show={results.length > 0}>
            <ResultsBoard page={page} onPatch={onPatch} />
          </Block>
          <Block title="캠페인 구조" note="타깃 → 메시지 → 채널 → 전환" show={has(st.target) || has(st.message) || diagramChannels.length > 0}>
            {editing ? (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <AutoText value={st.target} onChange={setSt('target')} placeholder="타깃" className="text-[12.5px] text-bluewood-700" />
                  <AutoText value={st.insight} onChange={setSt('insight')} placeholder="타깃 인사이트" className="text-[12.5px] text-bluewood-700" />
                  <AutoText value={(st.channels || []).join(', ')} onChange={(v) => setSt('channels')(v.split(',').map(s => s.trim()).filter(Boolean))} placeholder="채널 (쉼표로 구분)" className="text-[12.5px] text-bluewood-700" />
                  <AutoText value={st.conversion} onChange={setSt('conversion')} placeholder="전환 행동" className="text-[12.5px] text-bluewood-700" />
                </div>
                <LinesEditor label="채널 믹스" hint="'채널 | 비중(숫자, 모르면 비움)'" rows={page.channels} keys={['name', 'share']} onChange={(rows) => set('channels')(rows.map(r => ({ name: r.name, share: Math.max(0, Math.min(100, Number(r.share) || 0)) })))} />
              </div>
            ) : (
              <>
                <CampaignDiagram structure={{ ...st, channels: diagramChannels }} />
                {page.channels.some(c => c.share > 0) && <div className="mt-5"><MiniLabel>채널 믹스</MiniLabel><ChannelBar channels={page.channels} /></div>}
              </>
            )}
          </Block>
          <Block title="전환 퍼널" note="단계 사이 전환율 · 그 단계를 움직인 최적화" show={page.funnel.length > 0}>
            {editing
              ? <LinesEditor label="" hint="'단계 | 수치' (큰 단계부터)" rows={page.funnel} keys={['label', 'value']} onChange={set('funnel')} />
              : <FunnelSteps funnel={page.funnel} executions={page.executions} />}
          </Block>
          <Block title="단계별 최적화" note={`${page.executions.length}건 · 무엇을 보고 무엇을 바꿨나`} show={page.executions.length > 0}>
            <div className="border-t border-surface-200"><OptimizationRows page={page} onPatch={onPatch} /></div>
          </Block>
          <Learnings items={page.executions.map(x => x.learning)} retrospective={page.retrospective} onRetro={set('retrospective')} placeholder="다음 캠페인에서 다르게 할 점" />
          <Artifacts artifacts={artifacts} />
        </section>
      </div>
    </EditCtx.Provider>
  );
}
