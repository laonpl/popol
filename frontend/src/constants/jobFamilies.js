// 직무 역량 + 업무 성향 → 추천 직업군 매핑.
// 실제 채용에서 각 직군이 요구하는 직무역량(competencies)과 선호 업무성향(workStyles)을
// 함께 반영해, 내 경험 태그(역량)와 성향의 겹침으로 적합도를 계산한다. (JOBDA식 역량+성향)
// competencies/workStyles 값은 competencies.js의 목록과 정확히 일치해야 함.

export const JOB_FAMILIES = [
  { name: '기획 / PM',        competencies: ['기획/전략', '시장·사용자 리서치', '프로젝트관리', '문제해결', '데이터분석'], workStyles: ['전략적', '목표지향', '주도적'], desc: '서비스·사업 기획, 일정/우선순위 관리' },
  { name: '개발 / 엔지니어',   competencies: ['구현/개발', '자동화/효율화', '품질관리', '데이터분석', '문제해결'],     workStyles: ['논리적', '분석적', '꼼꼼함'], desc: '소프트웨어 설계·구현·운영' },
  { name: '디자인 / UX',       competencies: ['디자인/UX', '시장·사용자 리서치', '콘텐츠제작', '기획/전략'],          workStyles: ['창의적', '공감적', '분석적'], desc: '사용자 경험·인터페이스 설계' },
  { name: '데이터 분석',       competencies: ['데이터분석', '문제해결', '자동화/효율화', '시장·사용자 리서치'],       workStyles: ['분석적', '논리적', '꼼꼼함'], desc: '데이터 기반 인사이트 도출' },
  { name: '마케팅',            competencies: ['마케팅', '콘텐츠제작', '데이터분석', '시장·사용자 리서치'],            workStyles: ['창의적', '도전적', '목표지향'], desc: '브랜드·퍼포먼스·콘텐츠 마케팅' },
  { name: '영업 / 세일즈',     competencies: ['영업', '고객/CS', '커뮤니케이션', '협업/팀워크'],                     workStyles: ['도전적', '주도적', '공감적'], desc: '고객 발굴·관계·매출 성장' },
  { name: '사무 / 경영지원',   competencies: ['문서화/기록관리', '프로젝트관리', '재무/회계', '법규/정책'],          workStyles: ['꼼꼼함', '신중함', '협력적'], desc: '문서·일정·자료 관리 등 운영 지원' },
  { name: '고객 / CS',         competencies: ['고객/CS', '커뮤니케이션', '협업/팀워크', '문서화/기록관리'],          workStyles: ['공감적', '협력적', '신중함'], desc: '고객 응대·문제 해결·만족도 관리' },
  { name: '콘텐츠 / 미디어',   competencies: ['콘텐츠제작', '프레젠테이션', '커뮤니케이션', '기획/전략'],            workStyles: ['창의적', '주도적', '공감적'], desc: '콘텐츠 기획·제작·전달' },
  { name: '재무 / 회계',       competencies: ['재무/회계', '데이터분석', '법규/정책', '문서화/기록관리'],            workStyles: ['꼼꼼함', '논리적', '신중함'], desc: '회계·자금·재무 분석' },
  { name: 'HR / 조직',         competencies: ['커뮤니케이션', '협업/팀워크', '리더십', '문서화/기록관리'],           workStyles: ['공감적', '협력적', '전략적'], desc: '채용·조직문화·인사 운영' },
];

function toObj(counts) {
  if (counts instanceof Map) return Object.fromEntries(counts);
  return counts || {};
}

/**
 * 내 직무역량 + 업무성향 카운트 → 추천 직업군 순위.
 * 점수 = 역량 겹침(보유횟수 합) × 2  +  성향 겹침(보유횟수 합) × 1.
 * (역량을 더 크게 반영하되 성향도 함께 반영 — 실제 채용의 역량+성향 평가 구조)
 */
export function recommendJobFamilies(competencyCounts = {}, workStyleCounts = {}) {
  const comp = toObj(competencyCounts);
  const style = toObj(workStyleCounts);
  return JOB_FAMILIES
    .map(fam => {
      const matched = fam.competencies.filter(c => comp[c] > 0);
      const styleMatched = (fam.workStyles || []).filter(s => style[s] > 0);
      const compScore = matched.reduce((s, c) => s + (comp[c] || 0), 0) * 2;
      const styleScore = styleMatched.reduce((s, w) => s + (style[w] || 0), 0);
      return { ...fam, matched, styleMatched, score: compScore + styleScore };
    })
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score || (b.matched.length - a.matched.length));
}

/**
 * 업무 성향만으로 잘 맞는 직군 추천 (성향 → 직무 환경 추천용).
 * 점수 = 성향 겹침(보유횟수 합).
 */
export function recommendByWorkStyle(workStyleCounts = {}) {
  const style = toObj(workStyleCounts);
  return JOB_FAMILIES
    .map(fam => {
      const styleMatched = (fam.workStyles || []).filter(s => style[s] > 0);
      const score = styleMatched.reduce((s, w) => s + (style[w] || 0), 0);
      return { name: fam.name, styleMatched, score };
    })
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score || (b.styleMatched.length - a.styleMatched.length));
}
