/* 채용공고(JD) 키워드 매칭.

   서류 통과 이력서를 분석하면 직무기술서와 키워드 중복도가 높다 — 즉 공고는 채점 기준표에 가깝다.
   공고 원문에서 직무 키워드를 뽑아 각 경험이 몇 개를 덮는지 보여주고, 비어 있는 키워드를 알려준다.
   형태소 분석기 없이 조사만 떼는 방식이라 완벽하지 않지만, 무엇을 강조할지 고르는 데는 충분하다. */

/* 채용공고 어디에나 나오는 상용구 — 신호가 없으므로 제외한다. */
const STOPWORDS = new Set([
  '회사', '채용', '모집', '지원', '지원자', '우대', '자격', '요건', '사항', '업무', '담당', '경력', '신입',
  '이상', '관련', '능력', '경험', '필수', '가능', '근무', '조건', '복지', '전형', '면접', '서류', '제출',
  '기간', '부문', '직무', '조직', '인재', '역량', '활용', '수행', '다양', '함께', '우리', '이해', '기본',
  '소통', '성장', '문화', '위한', '대한', '통해', '있는', '또는', '그리고', '최소', '학력', '무관', '정규직',
  '계약직', '연봉', '상세', '아래', '내용', '진행', '주요', '기타', '이런', '분들', '이력서', '포트폴리오',
  'and', 'or', 'the', 'with', 'for', 'you', 'we', 'our', 'your', 'will', 'work', 'team', 'years', 'year',
  'skills', 'skill', 'ability', 'plus', 'must', 'have', 'are', 'who', 'job', 'about', 'more', 'from',
]);

/* 길이가 긴 것부터 떼어내야 '으로서'가 '으로'로 잘못 잘리지 않는다. */
const PARTICLES = [
  '으로써', '으로서', '에서의', '에게서', '이라는', '라는', '으로', '에서', '에게', '부터', '까지',
  '와의', '과의', '에는', '이나', '거나', '하는', '하기', '했던', '등의', '들의', '들을', '들이',
  '을', '를', '이', '가', '은', '는', '에', '의', '과', '와', '도', '로', '만', '등', '들',
];

function normalizeToken(raw) {
  let token = raw.trim();
  if (!token) return '';
  // 한글은 조사를 떼되, 떼고 나서 2자 미만이 되면 원형을 유지한다.
  if (/[가-힣]$/.test(token)) {
    for (const particle of PARTICLES) {
      if (token.length > particle.length + 1 && token.endsWith(particle)) {
        token = token.slice(0, -particle.length);
        break;
      }
    }
  }
  if (token.length < 2) return '';
  if (STOPWORDS.has(token)) return '';
  if (/^\d+$/.test(token)) return '';
  return token;
}

/** 공고 원문에서 빈도 높은 직무 키워드를 뽑는다. */
export function extractJdKeywords(text, limit = 20) {
  const cleaned = String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#./]+/gu, ' ');
  if (!cleaned.trim()) return [];

  const counts = new Map();
  cleaned.split(/\s+/).forEach(raw => {
    const token = normalizeToken(raw);
    if (!token) return;
    counts.set(token, (counts.get(token) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }));
}

/* 경험 쪽 텍스트 — 제목·태그·구조화 결과를 한 덩어리로 합쳐 부분 일치로 본다.
   "데이터 분석" (공고) ↔ "데이터를 분석했다" (경험)를 같은 것으로 잡기 위함이다. */
function experienceText(experience = {}) {
  const sr = experience.structuredResult || {};
  return [
    experience.title,
    ...(experience.keywords || []),
    ...(experience.competencyTags || []),
    ...(experience.skills || []),
    sr.intro, sr.task, sr.process, sr.output, sr.growth,
    JSON.stringify(sr.projectOverview || {}),
    JSON.stringify(sr.keyExperiences || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** 경험 하나가 공고 키워드를 얼마나 덮는지. keywords는 extractJdKeywords의 결과. */
export function matchExperienceToJd(experience, keywords = []) {
  if (keywords.length === 0) return { matched: [], score: 0 };
  const text = experienceText(experience);
  const matched = keywords.filter(({ keyword }) => text.includes(keyword)).map(item => item.keyword);
  // 상위 12개를 다 덮으면 100%. 공고 키워드가 그보다 적으면 그 개수를 기준으로 삼는다.
  const denominator = Math.max(1, Math.min(keywords.length, 12));
  return { matched, score: Math.min(100, Math.round(matched.length / denominator * 100)) };
}

/** 선택한 경험들이 공고 키워드를 얼마나 덮는지 — 아직 비어 있는 키워드를 알려준다. */
export function summarizeJdCoverage(experiences = [], keywords = []) {
  if (keywords.length === 0) return { covered: [], uncovered: [], score: 0 };
  const texts = experiences.map(experienceText);
  const covered = [];
  const uncovered = [];
  keywords.forEach(({ keyword }) => {
    if (texts.some(text => text.includes(keyword))) covered.push(keyword);
    else uncovered.push(keyword);
  });
  return { covered, uncovered, score: Math.round(covered.length / keywords.length * 100) };
}
