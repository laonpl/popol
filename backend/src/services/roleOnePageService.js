/**
 * PM·마케터 '핵심 경험 한 장' 전용 추출 — 개발자의 analyze-git(기여도·아키텍처·코드·트러블슈팅)에 대응하는
 * 직군 고유 데이터(PM: 리서치 규모·산출물·사용자 플로우·PRD 스펙·이슈 대응 / 마케터: 캠페인 지표·채널 믹스·퍼널·소재·성과 대응)를
 * 한 번의 가벼운 호출로 뽑는다. 결과는 structuredResult.pmOnePage / campaignOnePage 에 저장된다.
 * 자료에 없는 수치는 groundOnePage 가 지운다(문장은 남기고 숫자 칸만 비움).
 */
import { generateWithRetry } from '../config/geminiClient.js';
import { parseJSON } from './geminiService.js';

const MATERIAL_LIMIT = 16000;

const PM_SCHEMA = `{
  "summary": "이 경험 한 문장 요약 — 내가 한 일과 결과",
  "goal": "목표·성공 기준",
  "contribution": ["내가 직접 한 일 한 줄"],
  "retrospective": "다음에 다르게 할 점·배운 점",
  "headline": { "label": "대표 성과 지표명", "value": "실측값", "before": "이전 값", "target": "목표값" },
  "research": [ { "label": "사용자 인터뷰", "value": "15명" } ],
  "deliverables": [ { "name": "PRD", "value": "24쪽" } ],
  "role": "맡은 역할", "team": "팀 구성", "tools": ["Figma"],
  "problem": "서비스가 푼 사용자 문제", "solution": "해결 방식",
  "outcomes": [ { "label": "지표", "value": "값" } ],
  "flow": [ { "label": "단계명(8자 이내)", "desc": "사용자가 하는 일 한 줄" } ],
  "exceptions": [ { "step": "flow의 단계명", "label": "예외 상황", "handling": "정책·처리 방식" } ],
  "decisions": [ {
    "title": "의사결정 제목", "step": "이 결정이 바꾼 flow 단계명 — 모르면 \"\"", "tags": ["우선순위"],
    "problem": "판단이 필요했던 문제", "evidence": "판단 근거가 된 리서치·데이터",
    "options": [ { "label": "검토한 대안", "chosen": true, "reason": "채택/기각 이유" } ],
    "action": "그 판단에 따라 내가 실제로 한 일", "validation": "무엇으로·누구를 대상으로 검증했나",
    "result": { "label": "결과 지표", "before": "", "after": "" }, "outcome": "검증으로 확인한 결과 한두 문장",
    "spec": { "story": "사용자로서 ~하고 싶다", "criteria": ["수용 기준"], "policies": [ { "condition": "조건", "rule": "처리 규칙" } ] },
    "issue": { "signal": "드러난 문제", "cause": "원인", "fix": "대응" },
    "learning": "배운 점"
  } ]
}`;

const CAMPAIGN_SCHEMA = `{
  "summary": "이 경험 한 문장 요약 — 내가 한 일과 결과",
  "goal": "목표·성공 기준",
  "contribution": ["내가 직접 한 일 한 줄"],
  "retrospective": "다음에 다르게 할 점·배운 점",
  "headline": { "label": "대표 성과 지표명(ROAS·매출·전환 등)", "value": "실측값", "before": "", "target": "" },
  "stats": [ { "label": "예산", "value": "1,200만원" } ],
  "channels": [ { "name": "Meta 광고", "share": 60 } ],
  "funnel": [ { "label": "노출", "value": "120만" } ],
  "role": "맡은 역할", "tools": ["Meta Ads Manager"],
  "problem": "캠페인 과제", "strategy": "핵심 전략",
  "outcomes": [ { "label": "지표", "value": "값" } ],
  "structure": { "target": "타깃", "insight": "타깃 인사이트", "message": "핵심 메시지", "channels": ["채널"], "conversion": "전환 행동·도착지" },
  "executions": [ {
    "title": "실행 제목", "stage": "이 실행이 움직인 퍼널 단계 — 노출·클릭·전환 중 하나", "tags": ["A/B 테스트"],
    "insight": "바꾸기로 한 계기 — 본 숫자·반응", "action": "바꾼 것 — 소재·타깃·입찰·랜딩 등",
    "result": { "label": "결과 지표", "before": "", "after": "" },
    "creatives": [ { "variant": "A", "format": "피드 이미지", "hook": "후킹 문구", "body": "본문", "cta": "CTA", "metric": "CTR 2.8%", "winner": true } ],
    "issue": { "signal": "이상 신호", "diagnosis": "진단", "fix": "조치" },
    "learning": "배운 점"
  } ]
}`;

const COMMON_RULES = `[규칙]
- 자료에 있는 사실·문구·수치만 사용한다. 근거가 없으면 빈 문자열 "" 또는 빈 배열 []로 둔다. 수치·대안·소재 문구를 지어내지 않는다.
- 자료가 한국어면 모든 값을 한국어로 쓴다. 각 문장은 1~2문장으로 짧게.
- 팀이 한 일과 본인이 한 일이 구분되면 본인 역할을 role에 적는다.
- 계획 수치(목표)를 실측(value/after)으로 옮기지 않는다. 목표는 target에만.
- headline·outcomes는 이 프로젝트·캠페인을 실행해서 나온 결과만. 문제 정의·시장 조사의 현황 통계(예: "취준생 평균 40시간", "응답자 62%가 불편")는 성과가 아니다 — problem 문장에만 쓴다.
- summary: 채용 담당자가 첫 줄로 읽을 문장. "무엇을 해서 → 어떤 결과"를 60자 안팎으로, 자료에 있는 사실·수치만.
- contribution: 팀이 아니라 본인이 직접 한 일만 3~5개, 동사로 끝나는 짧은 한 줄씩 (예: "PRD 24쪽 작성", "인터뷰 15명 진행·분석"). 본인 역할이 자료에 없으면 [].
- goal: 시작 전에 정한 목표·성공 기준이 자료에 적혀 있을 때만. 달성한 결과 수치를 목표로 옮겨 쓰지 않는다. 없으면 "".
- retrospective: 자료에 적힌 배운 점·회고만 1~2문장. "~했다면 ~했을 것" 같은 가정을 새로 지어내지 않는다. 없으면 "".
- 정책·수용 기준·예외 처리에 자료에 없는 임계값·시간·비율(예: "신뢰도 90% 이상", "3초 이내")을 만들지 않는다. 자료가 단계 이름만 말하면 숫자 없이 쓴다.`;

function pmPrompt(material) {
  return `당신은 기획/PM 포트폴리오 편집자입니다. 개발자 포트폴리오의 GitHub 기여도·아키텍처·코드·트러블슈팅 자리에
PM 고유 산출물(대표 지표·리서치 규모·기획 산출물·사용자 플로우·의사결정·PRD 스펙·이슈 대응)을 넣은 '한 장'을 만듭니다.
아래 자료에서 그 내용을 추출해 순수 JSON만 반환하세요.

${COMMON_RULES}
- research: 인터뷰·설문·VOC·사용성 테스트·로그 분석처럼 사용자 조사 규모가 숫자로 나온 것만, 최대 4개.
- deliverables: 직접 만든 기획 산출물(PRD·와이어프레임·정책서·테스트케이스·이벤트 명세 등) 최대 5개. 분량 숫자가 없으면 value는 "".
- flow: 사용자가 서비스를 쓰는 핵심 흐름 3~6단계. exceptions: 그 흐름의 예외 상황과 정책 최대 4개.
- decisions: 핵심 기획 의사결정 2~4개. options에는 실제로 비교한 대안만(채택 chosen=true, 기각 false).
  step은 그 결정이 바꾼 flow 단계명을 flow의 label 그대로(자료로 알 수 있을 때만, 모르면 "").
  action은 본인이 직접 한 실행만, validation은 검증 방법·대상, outcome은 그 검증에서 실제로 확인한 결과(자료에 없으면 "").
  spec은 그 결정이 PRD·화면 정책·수용 기준으로 어떻게 옮겨졌는지(자료에 있을 때만). issue는 QA·출시·운영 중 드러난 문제와 대응.

자료:
${material}

아래 형식의 JSON만 출력 (설명·마크다운 금지):
${PM_SCHEMA}`;
}

function campaignPrompt(material) {
  return `당신은 마케터 포트폴리오 편집자입니다. 개발자 포트폴리오의 GitHub 기여도·아키텍처·코드·트러블슈팅 자리에
마케터 고유 산출물(캠페인 대표 지표·예산·채널 믹스·퍼널·캠페인 구조·광고 소재·성과 대응)을 넣은 '한 장'을 만듭니다.
아래 자료에서 그 내용을 추출해 순수 JSON만 반환하세요.

${COMMON_RULES}
- stats: 예산·매출·기간·도달 등 캠페인 규모 수치 최대 4개.
- channels: 채널별 예산 또는 성과 비중(%). 자료에 비중이 없으면 share는 0으로 두고 채널명만.
- funnel: 노출→클릭→전환처럼 같은 캠페인의 단계 수치가 있을 때만, 큰 단계부터 최대 4개.
- structure: 타깃 → 메시지 → 채널 → 전환으로 이어지는 캠페인 설계.
- executions: 핵심 최적화 2~4개 — 무엇을 보고(insight) 무엇을 바꿨고(action) 숫자가 어떻게 됐나(result). stage는 자료로 알 수 있을 때만, 모르면 "". creatives의 hook·body는 자료에 적힌 광고·콘텐츠 문구를 글자 그대로 복사한다(A/B면 각각, 성과가 나은 쪽 winner=true).
  자료에 소재 유형만 있고 실제 카피가 없으면 creatives는 []로 둔다. 카피를 지어내지 않는다.
  issue는 성과가 꺾이거나 예상과 달랐던 신호와 대응.

자료:
${material}

아래 형식의 JSON만 출력 (설명·마크다운 금지):
${CAMPAIGN_SCHEMA}`;
}

/* ── 정규화 ── */
const str = (v, max = 400) => String(v ?? '').replace(/\*\*/g, '').trim().slice(0, max);
const arr = (v) => (Array.isArray(v) ? v : []);
const strList = (v, n = 8, max = 60) => arr(v).map(x => str(x, max)).filter(Boolean).slice(0, n);
const pair = (v, a, b, n) => arr(v).map(x => ({ [a]: str(x?.[a], 60), [b]: str(x?.[b], 60) })).filter(x => x[a]).slice(0, n);
const metric = (v = {}) => ({ label: str(v.label, 60), value: str(v.value ?? v.after, 40), before: str(v.before, 40), target: str(v.target, 40) });
const change = (v = {}) => ({ label: str(v.label, 60), before: str(v.before, 40), after: str(v.after, 40) });
const issue = (v = {}, keys) => Object.fromEntries(keys.map(k => [k, str(v?.[k])]));

const caseFields = (raw = {}) => ({
  summary: str(raw.summary, 200), goal: str(raw.goal, 300),
  contribution: strList(raw.contribution, 5, 140), retrospective: str(raw.retrospective, 400),
});

function normalizePm(raw = {}) {
  return {
    ...caseFields(raw),
    headline: metric(raw.headline),
    research: pair(raw.research, 'label', 'value', 4),
    deliverables: pair(raw.deliverables, 'name', 'value', 5),
    role: str(raw.role, 80), team: str(raw.team, 80), tools: strList(raw.tools, 8, 30),
    problem: str(raw.problem, 600), solution: str(raw.solution, 600),
    outcomes: pair(raw.outcomes, 'label', 'value', 5),
    flow: arr(raw.flow).map(s => ({ label: str(s?.label, 24), desc: str(s?.desc, 160) })).filter(s => s.label).slice(0, 6),
    exceptions: arr(raw.exceptions).map(e => ({ step: str(e?.step, 24), label: str(e?.label, 80), handling: str(e?.handling, 200) })).filter(e => e.label).slice(0, 4),
    decisions: arr(raw.decisions).map(d => ({
      title: str(d?.title, 80), step: str(d?.step, 24), tags: strList(d?.tags, 4, 20),
      problem: str(d?.problem), evidence: str(d?.evidence),
      options: arr(d?.options).map(o => ({ label: str(o?.label, 100), chosen: o?.chosen === true, reason: str(o?.reason, 200) })).filter(o => o.label).slice(0, 4),
      action: str(d?.action), validation: str(d?.validation), outcome: str(d?.outcome),
      result: change(d?.result),
      spec: {
        story: str(d?.spec?.story, 200),
        criteria: strList(d?.spec?.criteria, 5, 160),
        policies: arr(d?.spec?.policies).map(p => ({ condition: str(p?.condition, 100), rule: str(p?.rule, 160) })).filter(p => p.condition || p.rule).slice(0, 5),
      },
      issue: issue(d?.issue, ['signal', 'cause', 'fix']),
      learning: str(d?.learning),
    })).filter(d => d.title || d.problem).slice(0, 4),
  };
}

function normalizeCampaign(raw = {}) {
  const st = raw.structure || {};
  return {
    ...caseFields(raw),
    headline: metric(raw.headline),
    stats: pair(raw.stats, 'label', 'value', 4),
    channels: arr(raw.channels).map(c => ({ name: str(c?.name, 30), share: Math.max(0, Math.min(100, Number(c?.share) || 0)) })).filter(c => c.name).slice(0, 6),
    funnel: pair(raw.funnel, 'label', 'value', 4),
    role: str(raw.role, 80), tools: strList(raw.tools, 8, 30),
    problem: str(raw.problem, 600), strategy: str(raw.strategy, 600),
    outcomes: pair(raw.outcomes, 'label', 'value', 5),
    structure: { target: str(st.target, 160), insight: str(st.insight, 200), message: str(st.message, 160), channels: strList(st.channels, 5, 30), conversion: str(st.conversion, 120) },
    executions: arr(raw.executions).map(x => ({
      title: str(x?.title, 80), stage: str(x?.stage, 10), tags: strList(x?.tags, 4, 20),
      insight: str(x?.insight), action: str(x?.action),
      result: change(x?.result),
      creatives: arr(x?.creatives).map(c => ({
        variant: str(c?.variant, 10), format: str(c?.format, 30), hook: str(c?.hook, 120), body: str(c?.body, 240),
        cta: str(c?.cta, 30), metric: str(c?.metric, 40), winner: c?.winner === true,
      })).filter(c => c.hook || c.body).slice(0, 3),
      issue: issue(x?.issue, ['signal', 'diagnosis', 'fix']),
      learning: str(x?.learning),
    })).filter(x => x.title || x.action).slice(0, 4),
  };
}

/* ── 수치 그라운딩 — 2자리 이상 숫자가 자료에 없으면 그 칸만 비운다 ── */
const numTokens = (v) => String(v ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || [];

const METRIC_KEYS = ['value', 'before', 'after', 'target', 'metric'];
const squash = (v) => String(v ?? '').toLowerCase().replace(/[\s.,·:;!?"'“”‘’()[\]<>~\-–—/|]/g, '');

/**
 * 자료에 근거한 것만 남긴다.
 * - 수치 칸(value·before·after·target·metric)·정책·수용 기준·예외: 모든 숫자가 자료에 있어야 한다 ("신뢰도 90% 이상" 같은 임계값 창작 방지)
 * - 그 밖의 서술: 2자리 이상 숫자가 자료에 없으면 그 칸을 비운다
 * - 광고 소재 문구: 후킹 문구가 자료에 그대로 있어야 한다 (가상의 카피 금지)
 * - 채널 비중: 자료에 "40%"처럼 적힌 비중만
 * - 값이 빈 지표 행(리서치·규모·퍼널·성과)은 뺀다
 */
export function groundOnePage(page, sourceText) {
  const source = String(sourceText || '');
  if (!source.trim()) return page;
  const src = new Set(numTokens(source));
  const flat = squash(source);
  const strict = (v) => numTokens(v).every(n => src.has(n));
  const loose = (v) => numTokens(v).filter(n => n.replace('.', '').length >= 2).every(n => src.has(n));
  // 행 단위 판정을 먼저 — 임계값을 지어낸 정책·기준·예외, 자료에 없는 카피는 행째 뺀다
  const g = { ...page };
  if (g.exceptions) g.exceptions = g.exceptions.filter(e => e.label && strict(e.label) && strict(e.handling));
  if (g.decisions) {
    g.decisions = g.decisions.map(d => ({ ...d, spec: {
      ...d.spec,
      criteria: (d.spec?.criteria || []).filter(c => c && strict(c)),
      policies: (d.spec?.policies || []).filter(p => p.condition && strict(p.condition) && strict(p.rule)),
    } }));
  }
  if (g.executions) {
    g.executions = g.executions.map(x => ({ ...x, creatives: (x.creatives || [])
      .filter(c => c.hook && flat.includes(squash(c.hook)))
      .map(c => ({ ...c, body: c.body && flat.includes(squash(c.body)) ? c.body : '' })) }));
  }
  if (g.channels) g.channels = g.channels.map(c => (c.share && !new RegExp(`(^|[^\\d.])${c.share}\\s*%`).test(source) ? { ...c, share: 0 } : c));
  // 그다음 칸 단위
  const walk = (node, key) => {
    if (Array.isArray(node)) return node.map(n => walk(n, key));
    if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v, k)]));
    if (typeof node !== 'string') return node;
    return (METRIC_KEYS.includes(key) ? strict(node) : loose(node)) ? node : '';
  };
  const out = walk(g);
  const valued = (rows) => (rows || []).filter(r => String(r.value || '').trim());
  for (const k of ['research', 'stats', 'funnel', 'outcomes']) if (out[k]) out[k] = valued(out[k]);
  if (out.contribution) out.contribution = out.contribution.filter(Boolean);
  return out;
}

function withTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`[${label}] 타임아웃 (${ms / 1000}초 초과)`)), ms))]);
}

/** jobCategory 'pm' → { pmOnePage }, 'marketer' → { campaignOnePage } */
export async function analyzeRoleOnePage(jobCategory, material) {
  const text = String(material || '').trim().slice(0, MATERIAL_LIMIT);
  if (!text) return null;
  const isPm = jobCategory === 'pm';
  const raw = await withTimeout(
    generateWithRetry(isPm ? pmPrompt(text) : campaignPrompt(text), {
      models: ['gemini-2.5-flash', 'gemini-3.1-flash-lite'],
      retries: 1,
      delayMs: 1200,
      rateLimitDelayMs: 4000,
      callTimeoutMs: 45000,
    }),
    100000,
    'RoleOnePage',
  );
  const parsed = parseJSON(raw, /\{[\s\S]*\}/) || {};
  const page = groundOnePage(isPm ? normalizePm(parsed) : normalizeCampaign(parsed), text);
  return isPm ? { pmOnePage: page } : { campaignOnePage: page };
}

/* ── 고양이 편집 챗봇 — 사용자가 말로 요청한 부분만 고친다 ── */
const EDIT_KEYS = {
  pm: Object.keys(normalizePm({})),
  marketer: Object.keys(normalizeCampaign({})),
};

function editPrompt(isPm, page, instruction, material, history) {
  const talk = history.map(h => `${h.role === 'user' ? '사용자' : '고양이'}: ${h.text}`).join('\n');
  return `당신은 FitPoly의 편집 도우미 고양이입니다. 사용자의 ${isPm ? '기획/PM' : '마케터'} '핵심 경험 한 장'(JSON)을 사용자의 수정 요청대로 고칩니다.

[규칙]
- 요청한 부분만 고친다. 요청과 관계없는 칸은 changes에 넣지 않는다.
- changes에는 바꾼 최상위 칸만, 그 칸의 "고친 뒤 전체 값"을 넣는다 (배열이면 배열 전체, 객체면 객체 전체). 칸 이름과 모양은 아래 스키마 그대로.
- 숫자는 사용자가 이번 요청·대화에 직접 적었거나 원자료·현재 한 장에 있는 것만 쓴다. 없는 수치·대안·카피를 지어내지 않는다.
  숫자가 필요한데 근거가 없으면 changes를 비우고 reply에서 그 숫자를 물어본다.
- 지우라는 요청이면 빈 문자열 "" 또는 빈 배열 []로 바꾼다.
- 문장은 자료가 한국어면 한국어로, 채용 담당자가 읽는 담백한 문장으로. 과장·미사여구 금지.
- 요청이 고칠 내용이 아니라 질문이면 changes는 {}로 두고 reply로 답한다.
- reply: 실제로 바꾼 내용과 똑같이 말한다(칸을 비웠으면 "비웠다"고, 자료에 근거가 없으면 없다고). 무엇이 더 필요한지 존댓말 한두 문장, 60자 안팎.

[스키마]
${isPm ? PM_SCHEMA : CAMPAIGN_SCHEMA}

[현재 한 장]
${JSON.stringify(page)}

[원자료]
${material || '(없음)'}
${talk ? `\n[이전 대화]\n${talk}\n` : ''}
[이번 수정 요청]
${instruction}

아래 형식의 JSON만 출력 (설명·마크다운 금지):
{ "reply": "", "changes": {} }`;
}

/**
 * 말로 한 수정 요청을 한 장에 반영한다 — 바뀐 최상위 칸만 정규화·그라운딩해서 돌려준다.
 * 그라운딩 근거 = 원자료 + 요청·대화 + 현재 한 장(사용자가 직접 고친 숫자는 지우지 않게).
 * 손대지 않은 칸은 정규화하지 않는다 — 글자 수 제한에 걸려 기존 문장이 잘리지 않게.
 * @returns {{ reply: string, changes: object }}
 */
export async function editRoleOnePage(jobCategory, { page = {}, instruction = '', material = '', history = [] } = {}) {
  const isPm = jobCategory === 'pm';
  const keys = EDIT_KEYS[isPm ? 'pm' : 'marketer'];
  const current = Object.fromEntries(keys.filter(k => page[k] !== undefined).map(k => [k, page[k]]));
  const talk = arr(history).slice(-6).map(h => ({ role: h?.role === 'user' ? 'user' : 'bot', text: str(h?.text, 300) })).filter(h => h.text);
  const text = String(material || '').trim().slice(0, 12000);
  const raw = await withTimeout(
    generateWithRetry(editPrompt(isPm, current, str(instruction, 500), text, talk), {
      models: ['gemini-2.5-flash', 'gemini-3.1-flash-lite'],
      retries: 1,
      delayMs: 1200,
      rateLimitDelayMs: 4000,
      callTimeoutMs: 45000,
    }),
    60000,
    'RoleOnePageEdit',
  );
  const parsed = parseJSON(raw, /\{[\s\S]*\}/) || {};
  const asked = Object.fromEntries(Object.entries(parsed.changes || {}).filter(([k]) => keys.includes(k)));
  const changedKeys = Object.keys(asked);
  if (!changedKeys.length) return { reply: str(parsed.reply, 200) || '어느 부분을 어떻게 고칠지 조금 더 알려 주세요.', changes: {} };
  const source = [text, str(instruction, 500), ...talk.filter(h => h.role === 'user').map(h => h.text), JSON.stringify(current)].join('\n');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const proposed = (isPm ? normalizePm : normalizeCampaign)({ ...current, ...asked });
  const grounded = groundOnePage(proposed, source);
  const changes = Object.fromEntries(changedKeys.filter(k => !same(grounded[k], current[k])).map(k => [k, grounded[k]]));
  if (!Object.keys(changes).length) {
    // 제안은 달랐는데 근거 없는 숫자가 지워져 결국 그대로면 — 고쳤다고 답하지 않고 숫자를 묻는다
    const strippedNumbers = changedKeys.some(k => !same(proposed[k], current[k]));
    return { reply: strippedNumbers ? '자료에서 근거가 되는 숫자를 찾지 못해 그대로 두었어요. 숫자를 직접 알려 주시면 넣을게요.' : '바꿀 부분을 찾지 못했어요. 어느 칸을 어떻게 고칠지 알려 주세요.', changes: {} };
  }
  const reply = str(parsed.reply, 200) || '요청하신 부분을 고쳤어요.';
  const stripped = Object.keys(changes).some(k => !same(grounded[k], proposed[k]));
  return { reply: stripped ? `${reply} 다만 자료에 없는 숫자가 들어간 부분은 빼고 반영했어요.` : reply, changes };
}

export { normalizePm, normalizeCampaign };
