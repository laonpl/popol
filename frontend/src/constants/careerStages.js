// 경력 단계 — 같은 경험도 "누가 지원하는가"에 따라 정리 기준이 달라진다.
// 첫 취업 준비생에게 실무 성과 문법을 강요하면 거짓말처럼 읽히고,
// 경력 이직자에게 학생 프로젝트 톤을 쓰면 미숙해 보인다.
// ⚠️ 백엔드 buildHumanVoiceRules(experiencePrompts.js)의 값과 반드시 동기화할 것.

export const CAREER_STAGES = [
  { value: 'first',       label: '첫 취업 준비',  description: '학생·취준생. 인턴이나 직무 경험은 아직 없어요' },
  { value: 'newgrad',     label: '신입 지원',     description: '인턴·직무 경험이 있고 신입으로 지원해요' },
  { value: 'experienced', label: '경력 이직',     description: '실무 경력을 쌓았고 경력직으로 이직해요' },
];

export const DEFAULT_CAREER_STAGE = 'first';

const VALUES = new Set(CAREER_STAGES.map(s => s.value));
export const normalizeCareerStage = (value) => (VALUES.has(value) ? value : DEFAULT_CAREER_STAGE);
