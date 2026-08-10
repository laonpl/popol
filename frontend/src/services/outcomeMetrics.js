/**
 * outcomeMetrics — "이 방식이 실제로 통했는가"를 재는 최소 지표.
 *
 * 배경: 산출물 품질 설계를 계속 다듬어 왔지만 성과 지표가 하나도 없었다.
 * 피드백 루프가 없으면 "인사담당자가 원하는 방식인가"는 영원히 추정으로 남는다.
 * 그래서 판단에 실제로 쓸 수 있는 것만 좁게 심는다.
 *
 * ① AI 출력 수정률     — 사용자가 얼마나 고쳐 썼는지. 품질 프록시. 이미 계산 가능한 데이터다
 * ② 결과 자기보고      — 서류 통과 / 면접 진행 (사용자가 직접 표시)
 *
 * 공개 링크 열람 깊이·체류 시간은 services/viewerTracking.js 로 옮겼다.
 * 사용자에게 링크별로 보여줘야 해서 Vercel 집계가 아니라 자체 DB에 적재한다.
 *
 * 전송은 @vercel/analytics(main.jsx에 이미 설치됨). 개인정보·본문은 절대 싣지 않는다 —
 * 길이·비율·개수 같은 숫자와 식별자만 보낸다.
 */
import { track } from '@vercel/analytics';

const DEV = import.meta.env?.DEV;

/** 이벤트 전송 — 실패해도 화면 동작에 영향을 주지 않는다 */
function send(name, props = {}) {
  const clean = Object.fromEntries(
    Object.entries(props).filter(([, v]) => v != null && v !== '')
  );
  if (DEV) console.debug('[metric]', name, clean);
  try { track(name, clean); } catch { /* 수집 실패는 무시 */ }
}

/* ── ① AI 출력 수정률 ──────────────────────────────────────────────
   본문을 보내지 않는다. 원본 대비 얼마나 길이가 달라졌는지와
   손댄 섹션 수만 보낸다. 100%에 가까울수록 AI 출력을 그대로 못 쓴 것. */
const len = (v) => String(v ?? '').replace(/\s+/g, '').length;

export function trackEditRate({ expId, jobCategory, aiSections = {}, savedSections = {} }) {
  const keys = [...new Set([...Object.keys(aiSections), ...Object.keys(savedSections)])];
  if (!keys.length) return;
  let changed = 0;
  let aiTotal = 0;
  let delta = 0;
  keys.forEach((k) => {
    const a = len(aiSections[k]);
    const s = len(savedSections[k]);
    aiTotal += a;
    delta += Math.abs(s - a);
    if (a !== s) changed += 1;
  });
  send('ai_edit_rate', {
    expId,
    jobCategory,
    sections: keys.length,
    changedSections: changed,
    // 길이 기준 변경률(%) — 200% 이상은 의미가 없으므로 자른다
    editPercent: aiTotal ? Math.min(200, Math.round((delta / aiTotal) * 100)) : 0,
  });
}

/* ── ② 결과 자기보고 ───────────────────────────────────────────────
   사용자가 "이 포트폴리오로 서류 통과했다 / 면접 봤다"를 표시하면 기록한다.
   이 값이 쌓이기 전까지 템플릿·산출물 구성의 효과는 전부 추정이다. */
export const OUTCOME_STAGES = [
  { value: 'submitted', label: '지원함' },
  { value: 'passed_screening', label: '서류 통과' },
  { value: 'interviewed', label: '면접 진행' },
  { value: 'offer', label: '최종 합격' },
  { value: 'rejected', label: '불합격' },
];

export function trackOutcome({ portfolioId, templateId, jobCategory, stage }) {
  if (!OUTCOME_STAGES.some(s => s.value === stage)) return;
  send('application_outcome', { portfolioId, templateId, jobCategory, stage });
}

/* ── 산출물 사용 기록 ──────────────────────────────────────────────
   어떤 포맷이 실제로 쓰이는지. PPT를 붙들고 개발했지만 아무도 안 쓴다면 그것도 정보다. */
export function trackExport({ format, templateId, jobCategory }) {
  send('portfolio_export', { format, templateId, jobCategory });
}
