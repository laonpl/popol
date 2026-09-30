import { analyzeText, detectSkills, hasSkill, validateProfile } from './gong/matching.js';
import { searchJobs } from './gong/search-cache.js';
import { jobRequirements } from './gong/fit.js';

const ROLE_ALIASES = {
  '기획 / PM': '서비스 기획자', '개발 / 엔지니어': '백엔드 개발자',
  '디자인 / UX': '프로덕트 디자이너', '데이터 분석': '데이터 분석가',
  '마케팅 / 콘텐츠': '마케터', '인사 / 조직': '인사 담당자',
};
const textOf = exp => [exp.title, exp.role, exp.description, ...(exp.skills || []), ...(exp.keywords || []), ...(exp.competencyTags || [])].filter(Boolean).join(' ');

export function makeSearchProfile(experienceProfile, options = {}) {
  const text = experienceProfile.summaries.map(textOf).join('\n');
  const inferred = analyzeText(text);
  const requested = options.search || {};
  const role = requested.role ?? options.targetRoles?.[0] ?? inferred.role;
  const profile = validateProfile({
    role: ROLE_ALIASES[role] || role,
    skills: [...new Set([...detectSkills(text), ...experienceProfile.skills.map(s => s.name)])].filter(s => s.length <= 30).slice(0, 10),
    level: requested.level ?? '전체',
    location: requested.location ?? '전국',
    recentDays: requested.recentDays ?? 0,
    sort: requested.sort ?? 'relevance',
    ...(requested.years !== undefined ? { years: requested.years } : {}),
  });
  if (!profile) {
    const error = new Error('직무와 검색 조건을 확인해주세요.');
    error.status = 400;
    throw error;
  }
  return profile;
}

export async function findExperienceJobs(experienceProfile, options = {}, search = searchJobs) {
  const profile = makeSearchProfile(experienceProfile, options);
  const result = await search(profile);
  const available = result.sources.some(source => source.status === 'ok') || result.index?.total > 0;
  const limit = Math.min(200, Math.max(1, Number(options.limit) || 60));
  const recommendations = result.jobs.slice(0, limit).map(job => {
    const requirements = jobRequirements(job, profile.role);
    const matchedExperiences = experienceProfile.summaries.map(exp => {
      const matchingSkills = job.skills.filter(skill => hasSkill(skill, textOf(exp)));
      return { id: exp.id, title: exp.title, matchingSkills };
    }).filter(exp => exp.matchingSkills.length).sort((a, b) => b.matchingSkills.length - a.matchingSkills.length).slice(0, 3);
    return {
      ...job, platform: job.source, fitScore: job.score,
      matchingReasons: [job.reason].filter(Boolean), matchedExperiences,
      documents: requirements.documents,
      missingSkills: requirements.skills.filter(skill => !profile.skills.some(own => own.toLowerCase() === skill.name.toLowerCase())).map(skill => ({ name: skill.name, preferred: skill.preferred })),
    };
  });
  return {
    recommendations, profile, sources: result.sources, message: result.message,
    generatedAt: result.checkedAt, cached: result.cached || false,
    total: result.matched ?? result.jobs.length, index: result.index,
    unavailable: !available,
    profileSummary: `${experienceProfile.total}개의 경험에서 찾은 ${profile.role} 공고`,
  };
}
