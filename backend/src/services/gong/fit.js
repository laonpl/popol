// Adapted from https://github.com/choi0806/gong (main); TypeScript removed for the FitPoly Node server.
import { detectSkills, hasSkill, ROLE_RULES, skillRegex, roleMatches } from "./matching.js";
import { evaluateBenchmark, resumeSignals } from "./benchmark.js";
const DOCUMENTS = [
  ["\uC774\uB825\uC11C", /이력서|resume|\bcv\b/i],
  ["\uC790\uAE30\uC18C\uAC1C\uC11C", /자기\s*소개서|자소서|cover\s*letter/i],
  ["\uD3EC\uD2B8\uD3F4\uB9AC\uC624", /포트폴리오|portfolio/i],
  ["\uACBD\uB825\uAE30\uC220\uC11C", /경력\s*기술서/],
  ["\uACBD\uB825\uC99D\uBA85\uC11C", /경력\s*증명서/],
  ["\uC878\uC5C5\uC99D\uBA85\uC11C", /졸업(?:\s*예정)?\s*증명서/],
  ["\uC131\uC801\uC99D\uBA85\uC11C", /성적\s*증명서/],
  ["\uC790\uACA9\uC99D \uC0AC\uBCF8", /자격증\s*사본/],
  ["\uBA74\uD5C8\uC99D \uC0AC\uBCF8", /면허증\s*사본/],
  ["\uC5B4\uD559\uC131\uC801\uD45C", /어학\s*성적/],
  ["\uC8FC\uBBFC\uB4F1\uB85D\uB4F1\uBCF8", /주민등록\s*등본/],
  ["\uC0AC\uC804 \uACFC\uC81C", /사전\s*과제|과제\s*전형|코딩\s*테스트|coding\s*test/i]
];
const QUALIFICATIONS = [
  { label: "\uC815\uBCF4\uCC98\uB9AC\uAE30\uC0AC", job: /정보처리\s*(?:산업)?기사/, have: /정보처리\s*(?:산업)?기사/ },
  { label: "\uAC04\uD638\uC0AC \uBA74\uD5C8", job: /간호사\s*면허/, have: /간호사\s*면허|면허\s*(?:번호|취득)|registered\s*nurse/i },
  { label: "\uC6B4\uC804\uBA74\uD5C8", job: /운전\s*면허|운전\s*가능/, have: /운전\s*면허/ },
  { label: "\uD559\uC0AC \uD559\uC704", job: /학사\s*(?:학위\s*)?(?:이상|소지)|대졸\s*이상|4년제\s*(?:대학|졸업)|bachelor/i, have: /학사|대학교|대학\s*졸업|university|bachelor/i },
  { label: "\uC11D\uC0AC \uD559\uC704", job: /석사\s*(?:학위\s*)?(?:이상|소지)|master'?s\s*degree/i, have: /석사|대학원|master/i },
  { label: "\uC601\uC5B4 \uB2A5\uB825", job: /영어\s*(?:능통|가능|회화|커뮤니케이션|소통|능력)|비즈니스\s*영어|business\s*english|fluent\s*(?:in\s*)?english|토익|toeic|opic|토플|toefl/i, have: /토익|toeic|opic|오픽|toefl|토플|ielts|영어\s*(?:능통|회화|가능)|business\s*english|fluent/i },
  { label: "\uC77C\uBCF8\uC5B4 \uB2A5\uB825", job: /일본어|jlpt/i, have: /일본어|jlpt|jpt/i },
  { label: "\uC911\uAD6D\uC5B4 \uB2A5\uB825", job: /중국어|hsk/i, have: /중국어|hsk/i },
  { label: "\uD68C\uACC4 \uC790\uACA9\uC99D", job: /전산\s*회계|재경\s*관리사|세무사|\bk?i?cpa\b|회계사/i, have: /전산\s*회계|재경\s*관리사|세무사|\bk?i?cpa\b|회계사/i },
  { label: "\uCEF4\uD4E8\uD130\uD65C\uC6A9\uB2A5\uB825", job: /컴퓨터\s*활용\s*능력|컴활/, have: /컴퓨터\s*활용\s*능력|컴활/ },
  { label: "\uAC74\uCD95\uAE30\uC0AC", job: /건축\s*(?:산업)?기사/, have: /건축\s*(?:산업)?기사/ }
];
const PREFERRED_SECTION = /우대\s*(?:사항|조건|요건)|이런\s*분이면\s*더|preferred\s*qualifications|nice[\s-]to[\s-]have|bonus\s*points/i;
const SOFT_SKILLS = /* @__PURE__ */ new Set(["\uCF58\uD150\uCE20", "\uACE0\uAC1D \uAD00\uB9AC", "\uB370\uC774\uD130 \uBD84\uC11D", "\uC11C\uBE44\uC2A4 \uAE30\uD68D", "UI/UX", "\uBE0C\uB79C\uB529", "Excel"]);
const PORTFOLIO_EVIDENCE = /포트폴리오|portfolio|github\.com|behance|dribbble|notion\.site/i;
function isPreferred(pattern, text) {
  const cut = text.search(PREFERRED_SECTION);
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  for (const match of text.matchAll(global)) {
    const index = match.index ?? 0;
    if (cut >= 0 && index >= cut) continue;
    const after = text.slice(index, index + 50).split(/[.\n•]/)[0];
    if (!/우대|preferred|plus/i.test(after)) return false;
  }
  return true;
}
function jobRequirements(job, role = "") {
  const related = ROLE_RULES.find((rule) => rule.name === role)?.related ?? [];
  const text = `${job.title}
${job.description}`;
  const skills = /* @__PURE__ */ new Map();
  for (const tag of job.stack ?? []) {
    const known = detectSkills(tag);
    const name = known.length === 1 ? known[0] : tag.trim();
    if (name) skills.set(name, false);
  }
  for (const skill of detectSkills(text)) if (!skills.has(skill) && (!SOFT_SKILLS.has(skill) || related.includes(skill))) skills.set(skill, isPreferred(skillRegex(skill), text));
  const documents = DOCUMENTS.filter(([, pattern]) => pattern.test(job.description)).map(([name]) => name);
  const qualifications = QUALIFICATIONS.filter((q) => q.job.test(text)).map((q) => ({ ...q, preferred: isPreferred(q.job, text) }));
  return { skills: [...skills].map(([name, preferred]) => ({ name, preferred })), documents, qualifications };
}
let signalCache;
const signalsOf = (text) => signalCache?.text === text ? signalCache.signals : (signalCache = { text, signals: resumeSignals(text) }).signals;
function assessFit(job, profile, resumeText) {
  const req = jobRequirements(job, profile.role);
  const has = (skill) => hasSkill(skill, resumeText) || profile.skills.some((s) => s.toLowerCase() === skill.toLowerCase());
  const matched = req.skills.filter((s) => has(s.name)).map((s) => s.name);
  const gaps = req.skills.filter((s) => !has(s.name)).map((s) => ({ label: s.name, kind: "skill", preferred: s.preferred }));
  const required = req.skills.filter((s) => !s.preferred), preferred = req.skills.filter((s) => s.preferred);
  const hits = (list) => list.filter((s) => has(s.name)).length;
  const names = (list, want) => list.filter((s) => has(s.name) === want).map((s) => s.name).join(", ");
  const breakdown = [];
  if (required.length) breakdown.push({ label: "\uD544\uC218 \uAE30\uC220", max: 45, points: 45 * hits(required) / required.length, detail: `\uACF5\uACE0 \uD544\uC218 \uAE30\uC220 ${required.length}\uAC1C \uC911 ${hits(required)}\uAC1C \uBCF4\uC720${hits(required) < required.length ? ` \xB7 \uC5C6\uC74C: ${names(required, false)}` : ""}` });
  else if (preferred.length) breakdown.push({ label: "\uD544\uC218 \uAE30\uC220", max: 45, points: 45 * (0.6 + 0.4 * hits(preferred) / preferred.length), detail: `\uD544\uC218 \uAE30\uC220\uC774 \uBA85\uC2DC\uB418\uC9C0 \uC54A\uC544 \uAE30\uBCF8 60%\uC5D0 \uC6B0\uB300 \uAE30\uC220 ${preferred.length}\uAC1C \uC911 ${hits(preferred)}\uAC1C \uBCF4\uC720\uB97C \uB354\uD588\uC5B4\uC694` });
  else {
    const own = profile.skills.filter((s) => hasSkill(s, `${job.title} ${job.description}`));
    const points = Math.max(27, profile.skills.length ? 45 * own.length / profile.skills.length : 27);
    breakdown.push({ label: "\uD544\uC218 \uAE30\uC220", max: 45, points, detail: `\uACF5\uACE0\uC5D0 \uAE30\uC220\uC774 \uBA85\uC2DC\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694. \uB0B4 \uAE30\uC220 ${profile.skills.length}\uAC1C \uC911 \uACF5\uACE0\uC5D0 \uC5B8\uAE09\uB41C ${own.length}\uAC1C \uAE30\uC900(\uCD5C\uC18C 60%)\uC73C\uB85C \uACC4\uC0B0\uD588\uC5B4\uC694` });
  }
  const roleMatch = roleMatches(profile.role, `${job.title} ${job.category || ""}`);
  breakdown.push({ label: "\uC9C1\uBB34 \uC77C\uCE58", max: 15, points: roleMatch ? 15 : 0, detail: roleMatch ? `\uACF5\uACE0 \uC81C\uBAA9\xB7\uC9C1\uAD70\uC774 '${profile.role}'\uC640 \uC77C\uCE58\uD574\uC694` : `\uACF5\uACE0 \uC81C\uBAA9\uC774 '${profile.role}'\uC640 \uB2EC\uB77C\uC694. \uAE30\uC220\uC774 \uACB9\uCCD0\uC11C \uCD94\uCC9C\uB41C \uACF5\uACE0\uC608\uC694` });
  const minYears = job.minYears ?? 0, years = profile.years ?? 0;
  if (minYears > years) gaps.push({ label: `\uACBD\uB825 ${Math.ceil(minYears)}\uB144 \uC774\uC0C1`, kind: "experience" });
  breakdown.push({ label: "\uACBD\uB825 \uC5F0\uCC28", max: 10, points: minYears > years ? 0 : 10, detail: minYears > years ? `\uACF5\uACE0\uB294 ${Math.ceil(minYears)}\uB144 \uC774\uC0C1, \uC774\uB825\uC11C\uB294 ${years ? `${years}\uB144` : "\uACBD\uB825 \uBBF8\uD655\uC778"}\uC774\uC5D0\uC694` : job.minYears ? `\uACF5\uACE0 \uCD5C\uC18C ${Math.ceil(minYears)}\uB144, \uB0B4 \uACBD\uB825 ${years}\uB144\uC73C\uB85C \uCDA9\uC871\uD574\uC694` : "\uACF5\uACE0\uC5D0 \uCD5C\uC18C \uACBD\uB825 \uC81C\uD55C\uC774 \uC5C6\uC5B4\uC694" });
  const quals = req.qualifications.map((q) => ({ ...q, met: q.have.test(resumeText) }));
  for (const q of quals) if (!q.met) gaps.push({ label: q.label, kind: "qualification", preferred: q.preferred });
  const requiredQuals = quals.filter((q) => !q.preferred);
  breakdown.push({ label: "\uC790\uACA9\xB7\uC5B4\uD559\xB7\uD559\uB825 \uC694\uAC74", max: 10, points: requiredQuals.length ? 10 * requiredQuals.filter((q) => q.met).length / requiredQuals.length : 10, detail: requiredQuals.length ? requiredQuals.map((q) => `${q.label} ${q.met ? "\uCDA9\uC871" : "\uC5C6\uC74C"}`).join(" \xB7 ") : quals.length ? `\uD544\uC218 \uC694\uAC74\uC740 \uC5C6\uACE0 \uC6B0\uB300: ${quals.map((q) => `${q.label} ${q.met ? "\uCDA9\uC871" : "\uC5C6\uC74C"}`).join(" \xB7 ")}` : "\uACF5\uACE0\uC5D0 \uD544\uC218 \uC790\uACA9\xB7\uC5B4\uD559\xB7\uD559\uB825 \uC694\uAC74\uC774 \uC5C6\uC5B4\uC694" });
  const benchmark = evaluateBenchmark(job, profile, signalsOf(resumeText));
  const metRows = benchmark.rows.filter((row) => row.met).length;
  for (const row of benchmark.rows) if (!row.met) gaps.push({ label: `${row.label} (${row.expected})`, kind: "benchmark", preferred: true });
  breakdown.push({ label: "\uD3C9\uADE0 \uC2A4\uD399 \uB300\uBE44", max: 15, points: benchmark.rows.length ? 15 * metRows / benchmark.rows.length : 15, detail: benchmark.rows.length ? `${benchmark.tier} ${benchmark.family} \uC9C1\uAD70 \uCC38\uACE0 \uAE30\uC900 ${benchmark.rows.length}\uAC1C \uC911 ${metRows}\uAC1C \uCDA9\uC871` : "\uC774 \uAE30\uC5C5\xB7\uC9C1\uAD70\uC5D0\uB294 \uCD94\uAC00 \uCC38\uACE0 \uAE30\uC900\uC774 \uC5C6\uC5B4\uC694" });
  const needsPortfolio = req.documents.includes("\uD3EC\uD2B8\uD3F4\uB9AC\uC624") && !PORTFOLIO_EVIDENCE.test(resumeText);
  if (needsPortfolio) gaps.push({ label: "\uD3EC\uD2B8\uD3F4\uB9AC\uC624", kind: "document" });
  breakdown.push({ label: "\uC81C\uCD9C \uC11C\uB958 \uC900\uBE44", max: 5, points: needsPortfolio ? 0 : 5, detail: needsPortfolio ? "\uACF5\uACE0\uAC00 \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uB97C \uC694\uAD6C\uD558\uB294\uB370 \uC774\uB825\uC11C\uC5D0\uC11C \uD3EC\uD2B8\uD3F4\uB9AC\uC624\xB7GitHub \uB9C1\uD06C\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694" : req.documents.length ? `\uC694\uAD6C \uC11C\uB958: ${req.documents.join(", ")}. \uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uC678 \uC11C\uB958\uB294 \uC900\uBE44 \uC5EC\uBD80\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC73C\uB2C8 \uC9C0\uC6D0 \uC804\uC5D0 \uCC59\uACA8\uC8FC\uC138\uC694` : "\uACF5\uACE0\uC5D0 \uD2B9\uBCC4\uD55C \uC81C\uCD9C \uC11C\uB958\uAC00 \uBA85\uC2DC\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694" });
  for (const part of breakdown) part.points = Math.round(part.points * 10) / 10;
  const score = Math.round(Math.min(100, breakdown.reduce((sum, part) => sum + part.points, 0)));
  const rank = (gap) => gap.kind === "benchmark" ? 2 : gap.preferred ? 1 : 0;
  gaps.sort((a, b) => rank(a) - rank(b));
  return { score, matched, gaps, documents: req.documents, documentsStated: req.documents.length > 0, breakdown, benchmark };
}
function fitLabel(score) {
  return score >= 80 ? "\uC798 \uB9DE\uC544\uC694" : score >= 60 ? "\uB3C4\uC804\uD574\uBCFC \uB9CC\uD574\uC694" : "\uBCF4\uC644\uC774 \uD544\uC694\uD574\uC694";
}
function isFit(value) {
  const fit = value;
  return !!fit && typeof fit.score === "number" && Array.isArray(fit.matched) && Array.isArray(fit.gaps) && Array.isArray(fit.documents) && fit.gaps.every((g) => g && typeof g.label === "string") && fit.documents.every((d) => typeof d === "string");
}
export {
  assessFit,
  fitLabel,
  isFit,
  jobRequirements
};
