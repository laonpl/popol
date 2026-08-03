// 경력 단계 — 같은 경험도 "누가 지원하는가"에 따라 정리 기준이 달라진다.
// 첫 취업 준비생에게 실무 성과 문법을 강요하면 거짓말처럼 읽히고,
// 경력 이직자에게 학생 프로젝트 톤을 쓰면 미숙해 보인다.
// ⚠️ 백엔드 buildHumanVoiceRules(experiencePrompts.js)의 값과 반드시 동기화할 것.

// 'experienced'(3~7년)와 'lead'(8년+)를 나눈 이유: 8년+ 성과는 대부분 "타인을 통해" 나오는데
// 스키마의 모든 필드가 1인칭 판단 기록이라 위임·기준 설계·조직 변화가 담길 자리가 없었다.
// 기존 데이터는 전부 'experienced'로 저장돼 있고 그대로 유효하다(마이그레이션 불필요).
export const CAREER_STAGES = [
  { value: 'first',       label: '첫 취업 준비',    description: '학생·취준생. 인턴이나 직무 경험은 아직 없어요' },
  { value: 'newgrad',     label: '신입 지원',       description: '인턴·직무 경험이 있고 신입으로 지원해요' },
  { value: 'experienced', label: '경력 이직 3~7년', description: '실무를 맡아 성과를 낸 경력직으로 이직해요' },
  { value: 'lead',        label: '리드 8년 이상',   description: '팀·조직 단위로 판단하고 다른 사람을 통해 성과를 냅니다' },
];

export const DEFAULT_CAREER_STAGE = 'first';

const VALUES = new Set(CAREER_STAGES.map(s => s.value));
export const normalizeCareerStage = (value) => (VALUES.has(value) ? value : DEFAULT_CAREER_STAGE);
