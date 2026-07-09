import { GitCommit } from 'lucide-react';

/* GitHub 분석(gitAnalysis·githubStats) 렌더링 — 개발자 포트폴리오·케이스 스터디 공용 */

const ACCENT = '#002F6C';

/* 마크다운/플레이스홀더 정리 */
function clean(v) {
  const t = String(v || '').trim();
  if (!t || t.startsWith('[작성 필요]') || t.startsWith('[검증 필요]')) return '';
  return t.replace(/\*\*/g, '').replace(/^#+\s/gm, '').trim();
}

/* 배열/문자열 → 정리된 문자열 라인 배열 */
export function toLines(v) {
  if (Array.isArray(v)) {
    return v
      .map(x => (typeof x === 'string' ? x : Object.values(x || {}).filter(s => typeof s === 'string').join(' ')))
      .map(s => s.trim())
      .filter(Boolean);
  }
  const s = clean(v);
  return s ? s.split('\n').map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean) : [];
}

/* ══ 코드 스니펫 — 실제 IDE(VS Code Dark+) 모습: 창 크롬 + 줄번호 + 문법 하이라이팅 + diff 색상 ══ */

/* 간이 토크나이저 — 표시용 근사 하이라이팅 (JS/TS/Python 계열 공통 키워드) */
const KW_CONTROL = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'yield', 'await', 'elif', 'pass', 'raise', 'match', 'when', 'not', 'and', 'or', 'in', 'of', 'is']);
const KW_DECL = new Set(['const', 'let', 'var', 'function', 'class', 'extends', 'implements', 'interface', 'type', 'enum', 'import', 'export', 'from', 'default', 'new', 'async', 'static', 'get', 'set', 'public', 'private', 'protected', 'readonly', 'def', 'lambda', 'with', 'as', 'struct', 'impl', 'fn', 'pub', 'use', 'mod', 'mut', 'package', 'void', 'int', 'float', 'double', 'boolean']);
const KW_LITERAL = new Set(['true', 'false', 'null', 'undefined', 'None', 'True', 'False', 'this', 'self', 'super', 'NaN']);

function tokenizeCodeLine(line) {
  const out = [];
  const re = /(\/\/.*|#\s.*|#$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d[\w.]*\b)|([A-Za-z_$][\w$]*)|([^A-Za-z0-9_$]+)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const [, comment, str, num, ident, other] = m;
    if (comment != null) out.push({ t: comment, c: '#6a9955' });
    else if (str != null) out.push({ t: str, c: '#ce9178' });
    else if (num != null) out.push({ t: num, c: '#b5cea8' });
    else if (ident != null) {
      let c = '#9cdcfe';
      if (KW_CONTROL.has(ident)) c = '#c586c0';
      else if (KW_DECL.has(ident) || KW_LITERAL.has(ident)) c = '#569cd6';
      else if (/^[A-Z]/.test(ident)) c = '#4ec9b0';
      else if (/^\s*\(/.test(line.slice(re.lastIndex))) c = '#dcdcaa'; // 함수 호출
      out.push({ t: ident, c });
    } else if (other != null) out.push({ t: other, c: '#d4d4d4' });
  }
  return out;
}

/* diff 라인 판정 — git patch(+/-/@@)를 GitHub 스타일 색으로 */
function parseDiffLine(raw) {
  if (/^@@/.test(raw)) return { sign: '', text: raw, hunk: true };
  if (/^\+(?!\+\+)/.test(raw)) return { sign: '+', text: raw.slice(1), bg: 'rgba(63,185,80,0.13)', signColor: '#3fb950' };
  if (/^-(?!--)/.test(raw)) return { sign: '-', text: raw.slice(1), bg: 'rgba(248,81,73,0.13)', signColor: '#f85149' };
  return { sign: '', text: raw };
}

export function CodeSnippet({ file, code, lead, explanation }) {
  const raw = String(code || '').replace(/\n+$/, '');
  const lines = raw ? raw.split('\n') : [];
  // +/- 라인이 2줄 이상이거나 hunk 헤더가 있으면 git diff로 간주
  const isDiff = lines.filter(l => /^[+-](?![+-]{2})/.test(l)).length >= 2 || /^@@/m.test(raw);
  const ext = /\.([a-z0-9]+)$/i.exec(String(file || ''))?.[1]?.toUpperCase();

  return (
    <div className="mb-3">
      {lead && <p className="mb-1.5 text-[12.5px] font-semibold text-bluewood-800">{lead}</p>}
      {(file || raw) && (
        <div className="overflow-hidden rounded-lg border border-[#30363d] bg-[#0d1117] shadow-md">
          {/* 창 크롬 — 트래픽 라이트 + 파일명 탭 */}
          <div className="flex items-center gap-1.5 border-b border-[#21262d] bg-[#161b22] px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#ff5f56' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#ffbd2e' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#27c93f' }} />
            {file && <span className="ml-1.5 truncate font-mono text-[11px] text-[#8b949e]">{file}</span>}
            <span className="ml-auto flex flex-shrink-0 items-center gap-1.5">
              {ext && !isDiff && <span className="rounded border border-[#30363d] px-1.5 py-px font-mono text-[9.5px] font-semibold text-[#8b949e]">{ext}</span>}
              {isDiff && <span className="rounded px-1.5 py-px font-mono text-[9.5px] font-bold text-[#3fb950]" style={{ backgroundColor: 'rgba(63,185,80,0.15)' }}>DIFF</span>}
            </span>
          </div>
          {/* 코드 본문 — 줄번호 + 하이라이팅 (+/- diff 라인 배경) */}
          {raw && (
            <div className="overflow-x-auto py-2 font-mono text-[11.5px] leading-[1.75]">
              {lines.map((l, i) => {
                const d = isDiff ? parseDiffLine(l) : { sign: '', text: l };
                if (d.hunk) {
                  return (
                    <div key={i} className="flex whitespace-pre px-0" style={{ backgroundColor: 'rgba(56,139,253,0.1)' }}>
                      <span className="w-9 flex-shrink-0 select-none pr-2 text-right text-[#4d5566]">…</span>
                      <span className="flex-1 pr-4 italic text-[#8b949e]">{d.text}</span>
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex whitespace-pre" style={d.bg ? { backgroundColor: d.bg } : undefined}>
                    <span className="w-9 flex-shrink-0 select-none pr-2 text-right text-[#4d5566]">{i + 1}</span>
                    <span className="w-4 flex-shrink-0 select-none text-center font-bold" style={{ color: d.signColor || 'transparent' }}>{d.sign || ' '}</span>
                    <span className="flex-1 pr-4">
                      {tokenizeCodeLine(d.text).map((tk, ti) => <span key={ti} style={{ color: tk.c }}>{tk.t}</span>)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {explanation && <p className="mt-1.5 text-[12.5px] leading-[1.7] text-bluewood-600">{explanation}</p>}
    </div>
  );
}

/* ── GitHub 분석 기반 프로젝트 카드 (코드 변경·트러블슈팅 상세) ── */
export function GitProjectCard({ exp, index }) {
  const tags = (exp.core_tech_stack || '').split(/,\s*/).map(s => s.trim()).filter(Boolean);
  const problem = toLines(exp.problem_definition);
  const action = toLines(exp.action_and_solution);
  const codeChanges = toLines(exp.code_changes);
  const snippets = Array.isArray(exp.code_snippets) ? exp.code_snippets.filter(s => s && (s.code || s.why || s.file)) : [];
  const troubleSnippets = Array.isArray(exp.troubleshooting_snippets) ? exp.troubleshooting_snippets.filter(s => s && (s.code || s.solution || s.issue)) : [];
  const trouble = toLines(exp.troubleshooting);
  const learning = toLines(exp.learning);

  const Block = ({ label, color, lines }) => (lines.length ? (
    <div>
      <p className="mb-1 text-[11px] font-bold" style={{ color }}>{label}</p>
      <ul className="space-y-1">
        {lines.map((l, i) => <li key={i} className="text-[13px] leading-[1.6] text-bluewood-600">• {l}</li>)}
      </ul>
    </div>
  ) : null);

  return (
    <div className="rounded-2xl border border-surface-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10.5px] font-black text-white" style={{ backgroundColor: ACCENT }}>{index + 1}</span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-extrabold leading-snug text-bluewood-900">{clean(exp.project_name) || `프로젝트 ${index + 1}`}</h3>
            {exp.period && <p className="text-[11px] text-bluewood-400">{clean(exp.period)}</p>}
          </div>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[30px]">
          {tags.slice(0, 8).map((t, i) => <span key={i} className="rounded bg-surface-100 px-1.5 py-0.5 text-[10.5px] font-medium text-bluewood-500">#{t}</span>)}
        </div>
      )}

      <div className="mt-3.5 space-y-3.5 pl-[30px]">
        <Block label="문제" color="#314157" lines={problem} />
        <Block label="해결" color={ACCENT} lines={action} />

        {clean(exp.core_impact) && (
          <div className="rounded-lg border border-caribbean-100 bg-caribbean-50/60 px-3 py-2">
            <p className="mb-0.5 text-[11px] font-bold text-caribbean-700">성과</p>
            <p className="text-[13px] font-semibold leading-[1.6] text-caribbean-800">{clean(exp.core_impact)}</p>
          </div>
        )}

        {snippets.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[11px] font-bold text-bluewood-700">코드 변경</p>
            {snippets.map((s, i) => <CodeSnippet key={i} file={s.file} code={s.code} explanation={s.why || s.change} />)}
          </div>
        ) : codeChanges.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[11px] font-bold text-bluewood-700">코드 변경</p>
            <ul className="space-y-1">
              {codeChanges.map((l, i) => <li key={i} className="text-[12.5px] leading-[1.5] text-bluewood-600">• {l}</li>)}
            </ul>
          </div>
        ) : null}

        {/* 트러블슈팅 — 코드 + 설명 조합 (없으면 텍스트) */}
        {troubleSnippets.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[11px] font-bold" style={{ color: '#b45309' }}>트러블슈팅</p>
            {troubleSnippets.map((s, i) => <CodeSnippet key={i} lead={s.issue} file={s.file} code={s.code} explanation={s.solution} />)}
          </div>
        ) : (
          <Block label="트러블슈팅" color="#b45309" lines={trouble} />
        )}

        {learning.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-bold text-bluewood-300">배운 점</p>
            <ul className="space-y-1">
              {learning.map((l, i) => <li key={i} className="text-[12.5px] italic leading-[1.55] text-bluewood-400">• {l}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── GitHub 커밋 기여도 ── */
export function ContributionStats({ stats }) {
  const pct = Number(stats.contributionPct) || 0;
  const langs = Array.isArray(stats.languages) ? stats.languages : [];
  const LANG_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

  return (
    <section className="mt-8 rounded-2xl border border-surface-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-100" style={{ color: ACCENT }}><GitCommit size={15} /></span>
        <h2 className="text-[16px] font-extrabold text-bluewood-900">GitHub 기여도</h2>
        {stats.repoName && <span className="text-[12px] text-bluewood-300">{stats.repoName}</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-surface-50 p-3.5">
          <p className="text-[22px] font-black leading-none" style={{ color: ACCENT }}>{stats.myCommits}</p>
          <p className="mt-1.5 text-[11.5px] font-medium text-bluewood-400">내 커밋</p>
        </div>
        <div className="rounded-xl bg-surface-50 p-3.5">
          <p className="text-[22px] font-black leading-none text-emerald-600">{pct}%</p>
          <p className="mt-1.5 text-[11.5px] font-medium text-bluewood-400">기여 비중</p>
        </div>
        <div className="rounded-xl bg-surface-50 p-3.5">
          <p className="text-[22px] font-black leading-none text-bluewood-800">{stats.totalCommits || '—'}</p>
          <p className="mt-1.5 text-[11.5px] font-medium text-bluewood-400">전체 커밋</p>
        </div>
        <div className="rounded-xl bg-surface-50 p-3.5">
          <p className="text-[22px] font-black leading-none text-bluewood-800">{stats.rank ? `${stats.rank}위` : '—'}</p>
          <p className="mt-1.5 text-[11.5px] font-medium text-bluewood-400">기여자 {stats.contributorCount || 0}명 중</p>
        </div>
      </div>

      {/* 기여 비중 바 — 원자료(내 커밋/전체)를 함께 표기해 근거 명시 */}
      {pct > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11.5px] text-bluewood-400 mb-1.5">
            <span>내 기여 = 내 커밋 {stats.myCommits} / 전체 {stats.totalCommits}</span>
            <span className="font-semibold text-bluewood-600">{pct}%</span>
          </div>
          <div className="h-2.5 w-full bg-surface-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: ACCENT }} />
          </div>
          <p className="mt-1.5 text-[10.5px] text-bluewood-300">* GitHub 기여자 통계(기본 브랜치 기준) 기반</p>
        </div>
      )}

      {/* 근거: 활동 기간 + 커밋 유형 분포 */}
      {(stats.activePeriod || (stats.commitTypes || []).length > 0) && (
        <div className="mt-5 border-t border-surface-100 pt-4">
          <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-bluewood-300">기여 근거</p>
          {stats.activePeriod && (
            <p className="mb-2.5 text-[12px] text-bluewood-500">
              활동 기간 <span className="font-semibold text-bluewood-700">{stats.activePeriod.first} ~ {stats.activePeriod.last}</span>
            </p>
          )}
          {(stats.commitTypes || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {stats.commitTypes.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-md bg-surface-100 px-2 py-1 text-[11.5px] text-bluewood-600">
                  <span className="font-bold text-bluewood-800">{t.type}</span>
                  <span className="text-bluewood-400">{t.count}회</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 언어 비율 */}
      {langs.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-bluewood-300">언어 구성</p>
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {langs.map((l, i) => (
              <div key={i} style={{ width: `${l.pct}%`, backgroundColor: LANG_COLORS[i % LANG_COLORS.length] }} title={`${l.name} ${l.pct}%`} />
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {langs.map((l, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[12px] text-bluewood-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: LANG_COLORS[i % LANG_COLORS.length] }} />
                {l.name} <span className="text-bluewood-400">{l.pct}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
