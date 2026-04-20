/**
 * portfolioSections.js
 * 템플릿별 섹션 레이블 / 표시할 섹션 집합 정의.
 * NotionPortfolioEditor, PreviewView 등에서 공통 참조.
 */

/** 에디터/미리보기에서 섹션 제목을 렌더할 때 쓰는 템플릿별 레이블 매핑. */
export const SECTION_LABELS = {
  ashley: {
    profile: '프로필',
    education: '학교',
    experiences: '경력 & 프로젝트',
    interviews: '인터뷰',
    books: '저서 & 글쓰기',
    lectures: '강연 & 모더레이터',
    skills: '이런 일을 할 수 있어요',
    values: '나를 들려주는 이야기',
    funfacts: '독특한 경험',
    contact: '연락처',
  },
  academic: {
    profile: '프로필',
    education: '학력',
    awards: '수상/장학금',
    experiences: 'Portfolio & Experience',
    curricular: '교과 활동',
    extracurricular: '비교과 & 자격증',
    skills: 'Skills',
    goals: 'Personal Statement',
    values: '소개글',
    contact: 'Contact',
  },
  notion: {
    profile: '프로필',
    education: '학력',
    awards: '수상/장학금',
    experiences: '경험',
    curricular: '교과 활동',
    extracurricular: '비교과 활동',
    skills: '기술',
    goals: '목표와 계획',
    values: '가치관',
    contact: '연락처',
  },
  timeline: {
    profile: '프로필',
    education: '학력',
    curricular: '학기별 수업',
    experiences: '활동 기록',
    goals: '스터디 계획',
    skills: '기술',
    awards: '수상/장학금',
    contact: '연락처',
  },
};

/** 템플릿별로 표시되는 섹션 ID 집합 (순서 의미있음). */
export const TEMPLATE_SECTION_MAP = {
  ashley: ['profile', 'education', 'awards', 'experiences', 'interviews', 'books', 'lectures', 'skills', 'goals', 'values', 'funfacts', 'contact'],
  academic: ['profile', 'education', 'awards', 'experiences', 'curricular', 'extracurricular', 'skills', 'goals', 'values', 'contact'],
  notion: ['profile', 'education', 'awards', 'experiences', 'curricular', 'extracurricular', 'skills', 'goals', 'values', 'contact'],
  timeline: ['profile', 'education', 'curricular', 'experiences', 'goals', 'skills', 'awards', 'contact'],
};

/** 직무 추천 패널 등 보조 UI에서 쓰는 짧은 섹션 라벨. */
export const SHORT_SECTION_LABELS = {
  education: '교육',
  awards: '수상',
  skills: '기술',
  goals: '목표와 계획',
  values: '가치관',
};
