/**
 * missingFields — 경험 정리 결과에서 "아직 안 채워진 항목"을 모은다.
 *
 * 배경: AI는 원본에 근거가 없으면 값을 비워 둔다(예전에는 "[작성 필요] (원본에 없음)"을
 * 본문에 그대로 흘려 넣어 결과물이 지저분했다). 이제 본문에서는 지우되,
 * 무엇이 비었는지는 여기서 모아 사용자가 한 번에 채울 수 있게 한다.
 *
 * 반환한 항목의 path로 setByPath를 쓰면 원본 structuredResult에 그대로 반영된다.
 */
import { EXP_SECTION_META, EXP_SECTION_KEYS } from './projectSections';
import { JOB_SPECIFIC_FIELDS } from '../stores/experienceStore';

const PLACEHOLDER = /^\s*(\[작성 필요\]|\[검증 필요\]|\[확인 필요\])/;

/** 값이 비었거나 플레이스홀더면 true */
export function isBlank(value) {
  const text = String(value ?? '').trim();
  return !text || PLACEHOLDER.test(text) || /^\s*$/.test(text);
}

export function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/** 불변 갱신 — 중간 객체/배열을 복사하며 내려간다 */
export function setByPath(obj, path, value) {
  const keys = path.split('.');
  const clone = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  let cursor = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const next = cursor[key];
    cursor[key] = Array.isArray(next) ? [...next] : { ...(next || {}) };
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return clone;
}

/* 그룹별 정의 — label(무엇을) / hint(왜 필요한지·어떻게 쓸지) */
const OVERVIEW_FIELDS = [
  { key: 'role', label: '나의 역할', hint: '팀에서 내가 직접 맡은 범위. "팀이 한 일"과 구분해서 쓰세요.' },
  { key: 'duration', label: '기간', hint: '예: 2026.03 ~ 2026.06 (4개월)' },
  { key: 'team', label: '팀 구성', hint: '예: 개발 2명 · 디자인 1명 · 기획 1명' },
  { key: 'goal', label: '목표', hint: '이 프로젝트로 무엇을 달성하려 했는지 한 문장.' },
];

/* scope — 같은 직무도 규모·권한이 다르면 다른 경험이다. 채용담당자가 "우리 맥락으로 옮겨오는가"를
   판단하는 정보이고, 비어 있으면 경험끼리 비교가 되지 않는다. */
const SCOPE_FIELDS = [
  { key: 'teamSize', label: '팀 구성 · 인원', hint: '예: 개발 2 · 디자인 1 · 기획 1. 혼자 했으면 "1인"이라고 쓰는 편이 낫습니다.' },
  { key: 'myAuthority', label: '내 결정 권한', hint: '"제안만 했다 / 내가 결정했다 / 승인받아 실행했다"의 구분. 과장하면 면접에서 바로 무너집니다.' },
  { key: 'scale', label: '다룬 규모', hint: '사용자 수·트래픽·예산·처리 건수 등. 모르면 비워 두세요 (추정 금지).' },
  { key: 'constraints', label: '당시 제약', hint: '기간·인력·예산·레거시·규정 중 실제로 판단을 제한한 것.' },
];

const REVIEW_FIELDS = [
  { key: 'struggle', label: '막혔던 지점', hint: '실제로 가장 안 풀렸던 부분. 면접에서 가장 자주 묻습니다.' },
  { key: 'misjudgment', label: '예상과 달랐던 점', hint: '"~일 줄 알았는데 실제로는 ~였다" 형태로.' },
  { key: 'limitation', label: '남은 한계', hint: '못 한 검증, 부족한 표본, 타협한 선택.' },
  { key: 'nextTime', label: '다시 한다면', hint: '같은 일을 다시 할 때 바꿀 한 가지.' },
];

/**
 * @returns [{ id, group, label, hint, path, value }]
 *   group: '프로젝트 기본' | '본문 섹션' | '직군 항목' | '핵심 경험 N' | '솔직 회고 N'
 */
export function collectMissingFields(exp) {
  const sr = exp?.structuredResult || {};
  const jobCategory = exp?.jobCategory || sr.jobCategory || 'common';
  const out = [];
  // impact: 'critical' = 비면 서류 심사에서 바로 걸리는 것 / 'nice' = 있으면 좋은 것.
  // 정직한 추출일수록 빈칸이 많아지므로, 전부 같은 무게로 늘어놓으면 사용자가 포기한다.
  const push = (group, label, hint, path, impact = 'nice') => {
    if (!isBlank(getByPath(sr, path))) return;
    out.push({ id: path, group, label, hint, path, value: '', impact });
  };

  OVERVIEW_FIELDS.forEach(f =>
    // 본인 역할이 비면 팀 성과와 구분되지 않는다 — 경력 검증에서 가장 먼저 걸리는 항목
    push('프로젝트 기본', f.label, f.hint, `projectOverview.${f.key}`, f.key === 'role' ? 'critical' : 'nice'));

  EXP_SECTION_KEYS.forEach(key =>
    push('본문 섹션', EXP_SECTION_META[key]?.label || key,
      '비어 있으면 포트폴리오에서 이 섹션이 통째로 빠집니다.', key,
      // 이 3개가 비면 "무엇을 왜 했는지"가 사라져 나머지 섹션도 읽히지 않는다
      ['overview', 'task', 'output'].includes(key) ? 'critical' : 'nice'));

  (JOB_SPECIFIC_FIELDS[jobCategory] || []).forEach(f =>
    push('직군 항목', f.label, f.subtitle || f.placeholder || '', `jobSpecific.${f.key}`));

  const keyExps = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
  keyExps.forEach((ke, i) => {
    const name = String(ke?.title || `핵심 경험 ${i + 1}`).slice(0, 18);
    push(`핵심 경험 · ${name}`, '성과 수치', '원본에 수치가 있을 때만. 없으면 비워 두세요.', `keyExperiences.${i}.metric`);
    push(`핵심 경험 · ${name}`, '결과', '무엇이 어떻게 달라졌는지.', `keyExperiences.${i}.result`, 'critical');
    push(`핵심 경험 · ${name}`, '배운 점', '단순 소감 말고 판단이 어떻게 바뀌었는지.', `keyExperiences.${i}.learning`);
    // 내가 직접 실행한 범위 — 면접에서 가장 자주 무너지는 지점(interviewPrep와 같은 기준)
    push(`핵심 경험 · ${name}`, '내가 직접 한 일',
      '팀이 한 일과 내가 한 일을 나눠 쓰세요. 비면 팀 성과로 읽힙니다.',
      `keyExperiences.${i}.decisionTrace.execution`, 'critical');
    push(`핵심 경험 · ${name}`, '결과를 확인한 근거',
      '어떤 로그·리포트·피드백으로 확인했는지. 수치만 있고 이게 없으면 근거 없는 주장이 됩니다.',
      `keyExperiences.${i}.decisionTrace.outcomeEvidence`, 'critical');
    SCOPE_FIELDS.forEach(f =>
      push(`경험 맥락 · ${name}`, f.label, f.hint, `keyExperiences.${i}.scope.${f.key}`,
        f.key === 'myAuthority' ? 'critical' : 'nice'));
    REVIEW_FIELDS.forEach(f =>
      push(`솔직 회고 · ${name}`, f.label, f.hint, `keyExperiences.${i}.honestReview.${f.key}`,
        f.key === 'struggle' ? 'critical' : 'nice'));
  });

  // critical 을 앞으로 — 패널이 이 순서를 그대로 쓴다
  return out.sort((a, b) => (a.impact === b.impact ? 0 : a.impact === 'critical' ? -1 : 1));
}

/** 서류 심사에서 바로 걸리는 빈칸만 */
export const criticalMissingFields = (fields = []) => fields.filter(f => f.impact === 'critical');

/** 입력값 { path: text } 을 structuredResult에 반영한 새 객체를 만든다 */
export function applyFilledFields(structuredResult, filled) {
  return Object.entries(filled).reduce((acc, [path, text]) => {
    const value = String(text ?? '').trim();
    return value ? setByPath(acc, path, value) : acc;
  }, structuredResult || {});
}

/** 그룹 순서를 유지하며 묶는다 */
export function groupMissingFields(fields) {
  const map = new Map();
  fields.forEach(f => {
    if (!map.has(f.group)) map.set(f.group, []);
    map.get(f.group).push(f);
  });
  return [...map.entries()].map(([group, items]) => ({ group, items }));
}
