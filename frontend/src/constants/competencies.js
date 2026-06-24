// 경험·공고·직무추천이 공유하는 "역량/성향 공용어".
// 근거: NCS 직업기초능력 10영역 + 실무 직무군 매핑, 잡다(JOBDA)·라이프멘토식 2축(역량+성향) 구조.
// ⚠️ 백엔드 프롬프트(buildMetaPrompt 등)의 허용 목록과 반드시 동기화할 것.

// ① 직무 역량 — 그린(caribbean) 칩. 경험당 2~4개.
export const JOB_COMPETENCIES = [
  '기획/전략',
  '시장·사용자 리서치',
  '데이터분석',
  '문제해결',
  '구현/개발',
  '디자인/UX',
  '자동화/효율화',
  '품질관리',
  '프로젝트관리',
  '문서화/기록관리',
  '프레젠테이션',
  '콘텐츠제작',
  '커뮤니케이션',
  '협업/팀워크',
  '리더십',
  '고객/CS',
  '마케팅',
  '영업',
  '재무/회계',
  '법규/정책',
];

// ② 업무 성향 — 네이비(primary) 칩. 경험당 2~3개.
export const WORK_STYLES = [
  '분석적',
  '논리적',
  '창의적',
  '목표지향',
  '전략적',
  '주도적',
  '협력적',
  '꼼꼼함',
  '도전적',
  '공감적',
  '실행지향',
  '신중함',
];

// 업무 성향별 한 줄 강점 (성향 추천 표시용)
export const WORK_STYLE_INFO = {
  '분석적': '데이터·근거로 판단하는',
  '논리적': '구조적으로 사고하는',
  '창의적': '새로운 방식을 시도하는',
  '목표지향': '성과·완수에 집중하는',
  '전략적': '큰 그림을 설계하는',
  '주도적': '먼저 움직이고 이끄는',
  '협력적': '함께 성과를 내는',
  '꼼꼼함': '디테일을 놓치지 않는',
  '도전적': '어려운 문제에 부딪히는',
  '공감적': '사람·고객을 이해하는',
  '실행지향': '빠르게 실행하는',
  '신중함': '리스크를 따져 결정하는',
};

const JOB_COMPETENCY_SET = new Set(JOB_COMPETENCIES);
const WORK_STYLE_SET = new Set(WORK_STYLES);

// AI/외부 입력에 섞인 비표준 값은 버리고 표준 태그만 남긴다.
export const sanitizeCompetencyTags = (tags = []) =>
  [...new Set((Array.isArray(tags) ? tags : []).map(t => String(t).trim()))].filter(t => JOB_COMPETENCY_SET.has(t));
export const sanitizeWorkStyleTags = (tags = []) =>
  [...new Set((Array.isArray(tags) ? tags : []).map(t => String(t).trim()))].filter(t => WORK_STYLE_SET.has(t));

// 칩 스타일 — 브랜드 톤 유지(직무역량=그린, 업무성향=네이비)
export const COMPETENCY_CHIP = 'bg-caribbean-50 text-caribbean-700 border border-caribbean-100';
export const WORKSTYLE_CHIP = 'bg-primary-50 text-primary-700 border border-primary-100';

// ③ 경험 유형(폴더) — 수납장 폴더 그룹핑용. (라이프멘토식 폴더)
export const EXPERIENCE_CATEGORIES = [
  '프로젝트',
  '인턴십',
  '대외활동',
  '동아리',
  '공모전',
  '학업·연구',
  '직무경험',
  '기타',
];
export const UNCATEGORIZED = '미분류';

export function readCategory(exp) {
  const c = String(exp?.category || '').trim();
  return EXPERIENCE_CATEGORIES.includes(c) ? c : UNCATEGORIZED;
}
