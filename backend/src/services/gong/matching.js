// Adapted from https://github.com/choi0806/gong (main); TypeScript removed for the FitPoly Node server.
const LEVELS = ["\uC804\uCCB4", "\uC2E0\uC785", "\uACBD\uB825", "\uC778\uD134", "\uD504\uB9AC\uB79C\uC11C"];
import { dateTime } from "./job-dates.js";
const skillPatterns = [
  ["React", /\breact(?:\.js)?\b/i],
  ["TypeScript", /\btypescript\b/i],
  ["JavaScript", /\bjavascript\b/i],
  ["Next.js", /\bnext\.?js\b/i],
  ["Vue", /\bvue(?:\.js)?\b/i],
  ["HTML", /\bhtml\b/i],
  ["CSS", /\bcss\b/i],
  ["Node.js", /\bnode\.?js\b/i],
  ["Python", /\bpython\b|파이썬/i],
  ["Java", /\bjava\b/i],
  ["Spring", /\bspring\b/i],
  ["SQL", /\bsql\b|mysql|postgresql/i],
  ["AWS", /\baws\b/i],
  ["Docker", /\bdocker\b/i],
  ["Kotlin", /\bkotlin\b/i],
  ["Swift", /\bswift\b/i],
  ["Flutter", /\bflutter\b/i],
  ["Figma", /\bfigma\b|피그마/i],
  ["UI/UX", /\bux\b|\bui\b|사용자 경험/i],
  ["Photoshop", /photoshop|포토샵/i],
  ["Illustrator", /illustrator|일러스트레이터/i],
  ["\uBE0C\uB79C\uB529", /branding|브랜딩/i],
  ["\uCF58\uD150\uCE20", /content|콘텐츠|컨텐츠/i],
  ["GA4", /\bga4\b|google analytics|구글 애널리틱스/i],
  ["SEO", /\bseo\b|검색 최적화/i],
  ["Excel", /\bexcel\b|엑셀/i],
  ["\uB370\uC774\uD130 \uBD84\uC11D", /데이터 분석|data analys/i],
  ["\uC11C\uBE44\uC2A4 \uAE30\uD68D", /서비스 기획|product manag|프로덕트 매니저/i],
  ["\uC601\uC0C1 \uD3B8\uC9D1", /영상 편집|premiere|after effects/i],
  ["\uACE0\uAC1D \uAD00\uB9AC", /고객 관리|\bcrm\b/i],
  ["AutoCAD", /\bautocad\b|오토캐드/i],
  ["SolidWorks", /solidworks/i]
];
const ROLE_RULES = [
  { name: "\uD504\uB860\uD2B8\uC5D4\uB4DC \uAC1C\uBC1C\uC790", pattern: /프론트.?엔드|front.?end|웹\s*개발/i, related: ["React", "TypeScript", "JavaScript", "Next.js", "Vue", "HTML", "CSS"], wantedTag: 669, query: "\uD504\uB860\uD2B8\uC5D4\uB4DC" },
  { name: "\uBC31\uC5D4\uB4DC \uAC1C\uBC1C\uC790", pattern: /백.?엔드|back.?end|서버\s*개발/i, related: ["Java", "Spring", "Node.js", "AWS", "Docker"], wantedTag: 872, query: "\uBC31\uC5D4\uB4DC" },
  { name: "\uD504\uB85C\uB355\uD2B8 \uB514\uC790\uC774\uB108", pattern: /프로덕트\s*디자이너|product\s*design|ux.?ui|ui.?ux|웹\s*디자이너/i, related: ["Figma", "UI/UX"], wantedTag: 521, query: "UX \uB514\uC790\uC774\uB108" },
  { name: "\uB370\uC774\uD130 \uBD84\uC11D\uAC00", pattern: /데이터\s*분석|data\s*analyst|data\s*scientist/i, related: ["Python", "SQL", "\uB370\uC774\uD130 \uBD84\uC11D"], wantedTag: 518, query: "\uB370\uC774\uD130 \uBD84\uC11D" },
  { name: "\uB9C8\uCF00\uD130", pattern: /마케터|마케팅|marketer|marketing/i, related: ["GA4", "SEO", "\uCF58\uD150\uCE20", "\uACE0\uAC1D \uAD00\uB9AC"], wantedTag: 523, query: "\uB9C8\uCF00\uD305" },
  { name: "\uC11C\uBE44\uC2A4 \uAE30\uD68D\uC790", pattern: /서비스\s*기획|product\s*manager|프로덕트\s*매니저/i, related: ["\uC11C\uBE44\uC2A4 \uAE30\uD68D"], wantedTag: 507, query: "\uC11C\uBE44\uC2A4 \uAE30\uD68D" },
  { name: "\uBAA8\uBC14\uC77C \uAC1C\uBC1C\uC790", pattern: /모바일\s*(?:개발|엔지니어)|\bandroid\b|\bios\b|\bflutter\b|react\s*native/i, related: ["Swift", "Kotlin", "Flutter"], wantedTag: 518, query: "\uBAA8\uBC14\uC77C \uAC1C\uBC1C" },
  { name: "\uADF8\uB798\uD53D \uB514\uC790\uC774\uB108", pattern: /그래픽\s*디자인|그래픽\s*디자이너|시각\s*디자인|graphic\s*design/i, related: ["Photoshop", "Illustrator", "\uBE0C\uB79C\uB529"], wantedTag: 521, query: "\uADF8\uB798\uD53D \uB514\uC790\uC774\uB108" },
  { name: "\uC601\uC0C1 \uD3B8\uC9D1\uC790", pattern: /영상\s*편집|영상\s*제작|video\s*edit/i, related: ["\uC601\uC0C1 \uD3B8\uC9D1"], wantedTag: 521, query: "\uC601\uC0C1 \uD3B8\uC9D1" },
  { name: "\uC601\uC5C5", pattern: /영업|세일즈|sales/i, related: ["\uACE0\uAC1D \uAD00\uB9AC"], wantedTag: 511, query: "\uC601\uC5C5" },
  { name: "\uC778\uC0AC \uB2F4\uB2F9\uC790", pattern: /인사\s*담당|인사\s*관리|human\s*resources|recruiter/i, related: [], wantedTag: 530, query: "\uC778\uC0AC" },
  { name: "\uD68C\uACC4 \uB2F4\uB2F9\uC790", pattern: /회계|세무|accountant/i, related: ["Excel"], wantedTag: 508, query: "\uD68C\uACC4" },
  { name: "\uAE30\uACC4 \uC124\uACC4", pattern: /기계\s*설계|mechanical\s*engineer/i, related: ["AutoCAD", "SolidWorks"], query: "\uAE30\uACC4 \uC124\uACC4" },
  { name: "\uAC04\uD638\uC0AC", pattern: /간호사|간호학|registered\s*nurse/i, related: [], query: "\uAC04\uD638\uC0AC" },
  { name: "\uAC74\uCD95 \uC124\uACC4", pattern: /건축\s*설계|건축사|architectural/i, related: ["AutoCAD"], query: "\uAC74\uCD95 \uC124\uACC4" },
  { name: "\uACE0\uAC1D \uC0C1\uB2F4", pattern: /고객\s*상담|고객\s*지원|customer\s*support/i, related: ["\uACE0\uAC1D \uAD00\uB9AC"], query: "\uACE0\uAC1D \uC0C1\uB2F4" }
];
function analyzeText(text) {
  const skills = skillPatterns.filter(([, pattern]) => pattern.test(text)).map(([skill]) => skill);
  const ranked = ROLE_RULES.map((rule) => ({ name: rule.name, score: (rule.pattern.test(text) ? 6 : 0) + rule.related.filter((s) => skills.includes(s)).length })).sort((a, b) => b.score - a.score);
  const yearsMatch = text.match(/(?:총\s*)?(?:경력|experience)\s*[:：]?\s*(\d+)\s*(?:년|years?)/i) || text.match(/(\d+)\s*년\s*차/);
  const years = yearsMatch ? Number(yearsMatch[1]) : void 0;
  const level = /프리랜서\s*(?:지원|희망)|freelance\s*(?:developer|designer)/i.test(text) ? "\uD504\uB9AC\uB79C\uC11C" : /인턴\s*(?:지원|희망)/.test(text) ? "\uC778\uD134" : years && years > 0 ? "\uACBD\uB825" : /신입|취업 준비|졸업 예정|entry.level/i.test(text) ? "\uC2E0\uC785" : "\uC804\uCCB4";
  return { role: ranked[0].score > 0 ? ranked[0].name : "", skills: skills.slice(0, 10), level, location: "\uC804\uAD6D", ...years !== void 0 ? { years } : {} };
}
function detectSkills(text) {
  return skillPatterns.filter(([, pattern]) => pattern.test(text)).map(([skill]) => skill);
}
function skillRegex(skill) {
  return skillPatterns.find(([name]) => name.toLowerCase() === skill.toLowerCase())?.[1];
}
function hasSkill(skill, text) {
  const known = skillPatterns.find(([name]) => name.toLowerCase() === skill.toLowerCase());
  if (known) return known[1].test(text);
  const escaped = skill.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !!escaped && new RegExp(`(?:^|[^a-z0-9+#])${escaped}(?:$|[^a-z0-9+#])`, "i").test(text);
}
function roleMatches(role, text) {
  const rule = ROLE_RULES.find((r) => r.name === role);
  return rule ? rule.pattern.test(text) : text.replace(/\s/g, "").toLowerCase().includes(role.replace(/\s/g, "").toLowerCase());
}
function matchScore(profile, text) {
  const skills = profile.skills.filter((s) => hasSkill(s, text));
  return { score: Math.round((skills.length + Number(roleMatches(profile.role, text))) / (profile.skills.length + 1) * 100), skills };
}
function deadlinePassed(value, now = Date.now()) {
  const time = dateTime(value, true);
  return Number.isFinite(time) && time <= now;
}
function rankJobs(profile, candidates, now = Date.now(), limit = 60) {
  const seen = /* @__PURE__ */ new Set();
  return candidates.flatMap((job) => {
    if (job.sample || deadlinePassed(job.dueAt, now) || dateTime(job.startsAt) > now) return [];
    if (profile.recentDays && (!Number.isFinite(dateTime(job.postedAt)) || dateTime(job.postedAt) < now - profile.recentDays * 864e5 || dateTime(job.postedAt) > now)) return [];
    if (profile.level === "\uC778\uD134" && job.level !== "\uC778\uD134") return [];
    if (profile.level === "\uC2E0\uC785" && (job.level === "\uC778\uD134" || job.level === "\uD504\uB9AC\uB79C\uC11C" || job.level === "\uC804\uCCB4" && job.minYears !== 0)) return [];
    if (profile.level === "\uACBD\uB825" && job.level !== "\uACBD\uB825" && !(job.level === "\uC804\uCCB4" && job.minYears !== void 0)) return [];
    if (profile.location && profile.location !== "\uC804\uAD6D" && !job.location.includes(profile.location)) return [];
    if ((profile.level === "\uC2E0\uC785" || profile.level === "\uC778\uD134") && (job.level === "\uACBD\uB825" || (job.minYears ?? 0) > 0)) return [];
    if (profile.years !== void 0 && (job.minYears ?? 0) > profile.years) return [];
    if (profile.level === "\uD504\uB9AC\uB79C\uC11C" && job.level !== "\uD504\uB9AC\uB79C\uC11C") return [];
    const matched = matchScore(profile, `${job.title} ${job.description} ${job.skills.join(" ")}`);
    const explicitOtherRole = ROLE_RULES.some((rule) => rule.name !== profile.role && rule.pattern.test(job.title));
    if (explicitOtherRole && !roleMatches(profile.role, job.title)) return [];
    const titleMatches = roleMatches(profile.role, `${job.title} ${job.category || ""}`);
    if (!titleMatches && matched.skills.length < Math.min(2, Math.max(1, profile.skills.length))) return [];
    const identity = `${job.company}|${job.title}|${job.location}|${job.level}|${job.dueAt || ""}`.toLowerCase().replace(/[\s㈜()[\]]/g, "");
    if (seen.has(identity)) return [];
    seen.add(identity);
    const reason = matched.skills.length ? `${matched.skills.slice(0, 3).join(" \xB7 ")} \uACBD\uD5D8\uACFC \uB9DE\uB294 \uACF5\uACE0\uC608\uC694.` : `${profile.role} \uC9C1\uBB34\uC640 \uAD00\uB828\uB41C \uACF5\uACE0\uC608\uC694.`;
    const score = (titleMatches ? 40 : 0) + (profile.skills.length ? 50 * matched.skills.length / profile.skills.length : 30) + (job.level === profile.level ? 10 : 0);
    return [{ ...job, skills: matched.skills, stack: job.stack ?? job.skills, score: Math.round(score), reason }];
  }).sort((a, b) => profile.sort === "latest" ? (dateTime(b.postedAt) || 0) - (dateTime(a.postedAt) || 0) || (b.score ?? 0) - (a.score ?? 0) : (b.score ?? 0) - (a.score ?? 0)).slice(0, limit);
}
function validateProfile(value) {
  if (!value || typeof value !== "object") return null;
  const p = value;
  if (p.recentDays !== void 0 && ![0, 7, 14, 30].includes(p.recentDays)) return null;
  if (p.sort !== void 0 && p.sort !== "relevance" && p.sort !== "latest") return null;
  if (typeof p.role !== "string" || !p.role.trim() || p.role.length > 60 || !Array.isArray(p.skills) || p.skills.length > 10 || p.skills.some((s) => typeof s !== "string" || s.length > 30) || !LEVELS.includes(p.level) || typeof p.location !== "string" || p.location.length > 30 || p.years !== void 0 && (typeof p.years !== "number" || !Number.isInteger(p.years) || p.years < 0 || p.years > 60)) return null;
  const role = p.role.trim().replace(/[<>\r\n]/g, "").trim();
  if (!role) return null;
  return { role, skills: p.skills.map((s) => String(s).trim()).filter(Boolean), level: p.level, location: p.location.trim(), ...p.years !== void 0 ? { years: p.years } : {}, ...p.recentDays !== void 0 ? { recentDays: p.recentDays } : {}, ...p.sort !== void 0 ? { sort: p.sort } : {} };
}
export {
  LEVELS,
  ROLE_RULES,
  analyzeText,
  deadlinePassed,
  detectSkills,
  hasSkill,
  matchScore,
  rankJobs,
  roleMatches,
  skillRegex,
  validateProfile
};
