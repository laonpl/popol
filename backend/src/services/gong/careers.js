// Adapted from https://github.com/choi0806/gong (main); TypeScript removed for the FitPoly Node server.
import { deadlinePassed, rankJobs } from "./matching.js";
import { normalizeJobDate } from "./job-dates.js";
import { experienceLevel, plainText, record as obj, string as str } from "./job-page.js";
const arr = (value) => Array.isArray(value) ? value.map(obj) : [];
const num = (value) => typeof value === "number" && Number.isFinite(value) ? value : void 0;
async function request(url, signal, accept = "application/json") {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(1e4)]), cache: "no-store", headers: { Accept: accept, "User-Agent": "Mozilla/5.0 (compatible; gongchat)" } });
  if (!response.ok) throw new Error(`source_http_${response.status}`);
  return response;
}
const CITY_REGION = [
  [/서울|seoul|강남|역삼|성수|신도림|여의도|잠실|을지로|광화문/i, "\uC11C\uC6B8"],
  [/경기|판교|성남|분당|수원|용인|광명|화성|평택|고양|일산|안양|부천|pangyo/i, "\uACBD\uAE30"],
  [/부산|busan/i, "\uBD80\uC0B0"],
  [/인천|incheon/i, "\uC778\uCC9C"],
  [/대전/, "\uB300\uC804"],
  [/대구/, "\uB300\uAD6C"],
  [/광주/, "\uAD11\uC8FC"],
  [/울산/, "\uC6B8\uC0B0"],
  [/세종/, "\uC138\uC885"],
  [/제주|jeju/i, "\uC81C\uC8FC"]
];
function withRegion(location) {
  const clean = location.replace(/\s+/g, " ").trim();
  if (!clean) return "\uC6D0\uBB38 \uD655\uC778";
  const region = CITY_REGION.find(([pattern]) => pattern.test(clean))?.[1];
  return region && !clean.includes(region) ? `${region} ${clean}` : clean;
}
function experienceLabel(minYears, maxYears, anyExperience = false) {
  if (anyExperience) return "\uACBD\uB825 \uBB34\uAD00";
  if (minYears === 0) return maxYears ? `\uC2E0\uC785~${maxYears}\uB144` : "\uC2E0\uC785";
  if (minYears !== void 0) return maxYears && maxYears < 100 ? `\uACBD\uB825 ${minYears}~${maxYears}\uB144` : `\uACBD\uB825 ${minYears}\uB144 \uC774\uC0C1`;
  return "\uACBD\uB825 \uC870\uAC74 \uC6D0\uBB38 \uD655\uC778";
}
function yearsIn(text) {
  if (/신입|경력\s*무관/.test(text)) return 0;
  const match = text.match(/(\d{1,2})\s*(?:년|\+?\s*years?)\s*(?:이상|차\s*이상|or more|of experience|\+)/i);
  return match ? Number(match[1]) : void 0;
}
function parseToss(data, checkedAt) {
  const list = obj(data).success;
  if (!Array.isArray(list)) throw new Error("toss_schema_changed");
  return arr(list).flatMap((item) => {
    const meta = (prefix) => arr(item.metadata).find((m) => str(m.name).startsWith(prefix))?.value;
    const location = str(obj(item.location).name);
    if (!num(item.id) || !str(item.title) || meta("\uCEE4\uB9AC\uC5B4\uD398\uC774\uC9C0 \uBA54\uB274\uC5D0") === true || !/seoul|korea|서울|부산|busan|판교/i.test(location)) return [];
    const dueAt = normalizeJobDate(meta("\uCEE4\uB9AC\uC5B4\uD398\uC774\uC9C0 \uCC44\uC6A9\uACF5\uACE0 \uD074\uB85C\uC9D5 \uC77C\uC790"));
    if (deadlinePassed(dueAt)) return [];
    const description = plainText(str(meta("Job Description")).replace(/^#+\s*/gm, ""));
    const employment = str(meta("Employment_Type"));
    const minYears = yearsIn(`${item.title} ${description}`);
    const company = str(meta("\uD3EC\uC9C0\uC158\uC758 \uC18C\uC18D")) || "\uD1A0\uC2A4";
    return [{ id: `toss-${item.id}`, company, title: str(item.title).trim(), source: "\uD1A0\uC2A4 \uCC44\uC6A9", url: `https://toss.im/career/job-detail?gh_jid=${item.id}`, location: withRegion(location.replace(/seoul/i, "\uC11C\uC6B8").replace(/busan/i, "\uBD80\uC0B0")), level: experienceLevel(`${item.title} ${employment === "\uC778\uD134" ? "\uC778\uD134" : ""} ${minYears ? "\uACBD\uB825" : ""}`, minYears), minYears, experience: experienceLabel(minYears), skills: [], description: description || str(item.title), category: str(meta("\uCEE4\uB9AC\uC5B4\uD398\uC774\uC9C0 \uB178\uCD9C Job Category")), dueAt, postedAt: normalizeJobDate(item.first_published), checkedAt, verification: "detail" }];
  });
}
function parseKakao(data, checkedAt) {
  const list = obj(data).jobList;
  if (!Array.isArray(list)) throw new Error("kakao_schema_changed");
  return arr(list).flatMap((item) => {
    const id = str(item.realId);
    if (!/^[A-Z]-\d+$/.test(id) || !str(item.jobOfferTitle) || item.closeFlag === true || item.privateFlag === true) return [];
    const dueAt = normalizeJobDate(item.endDate) || normalizeJobDate(item.resumeSubmissionEndDatetime);
    if (deadlinePassed(dueAt)) return [];
    const title = str(item.jobOfferTitle).trim();
    const description = [item.introduction, item.workContentDesc, item.qualification, item.jobOfferProcessDesc].map(plainText).filter(Boolean).join("\n\n");
    const minYears = yearsIn(`${title} ${plainText(item.qualification)}`);
    const skills = arr(item.skillSetList).map((s) => str(s.skillSetName)).filter(Boolean);
    return [{ id: `kakao-${id}`, company: str(item.companyName) || "\uCE74\uCE74\uC624", title, source: "\uCE74\uCE74\uC624 \uCC44\uC6A9", url: `https://careers.kakao.com/jobs/${id}`, location: withRegion(str(item.locationName)), level: experienceLevel(`${title} ${str(item.employeeTypeName)}`, minYears), minYears, experience: experienceLabel(minYears), skills, description, category: str(item.jobTypeName), dueAt, postedAt: normalizeJobDate(item.regDate), checkedAt, verification: "detail" }];
  });
}
function parseNaver(data, checkedAt) {
  const list = obj(data).list;
  if (!Array.isArray(list)) throw new Error("naver_schema_changed");
  return arr(list).flatMap((item) => {
    const id = num(item.annoId), title = str(item.annoSubject).trim();
    if (!id || !title || !/진행/.test(str(item.stateCdNm))) return [];
    const dueAt = normalizeJobDate(item.endYmdTime), startsAt = normalizeJobDate(item.staYmdTime);
    if (deadlinePassed(dueAt)) return [];
    const entry = str(item.entTypeCdNm), employment = str(item.empTypeCdNm);
    const minYears = entry === "\uC2E0\uC785" || entry === "\uBB34\uAD00" ? 0 : yearsIn(title);
    const level = experienceLevel(`${title} ${entry === "\uBB34\uAD00" ? "\uACBD\uB825 \uBB34\uAD00" : entry} ${employment}`, minYears);
    return [{ id: `naver-${id}`, company: str(item.sysCompanyCdNm) || "NAVER", title, source: "\uB124\uC774\uBC84 \uCC44\uC6A9", url: `https://recruit.navercorp.com/rcrt/view.do?annoId=${id}`, location: "\uC6D0\uBB38 \uD655\uC778", level, minYears, experience: entry === "\uBB34\uAD00" ? "\uACBD\uB825 \uBB34\uAD00" : entry || "\uACBD\uB825 \uC870\uAC74 \uC6D0\uBB38 \uD655\uC778", skills: [], description: [title, item.classCdNm, item.subJobCdNm, employment].map(str).filter(Boolean).join("\n"), category: `${str(item.classCdNm)} ${str(item.subJobCdNm)}`.trim(), dueAt, startsAt, checkedAt, verification: "listing" }];
  });
}
function parseWoowahan(data, checkedAt) {
  const list = obj(obj(data).data).list;
  if (!Array.isArray(list)) throw new Error("woowahan_schema_changed");
  return arr(list).flatMap((item) => {
    const number = str(item.recruitNumber), title = str(item.recruitName).trim();
    if (!/^R\d+$/.test(number) || !title || item.isHidden === true || item.recruitDeleteYn === true || item.isAfterOrEqualEndDay === true) return [];
    const dueAt = item.isUnlimitedEndDate === true ? void 0 : normalizeJobDate(item.recruitEndDate);
    if (deadlinePassed(dueAt)) return [];
    const min = num(item.careerRestrictionMinYears), max = num(item.careerRestrictionMaxYears);
    const anyExperience = min === -1 || min === void 0 && /무관/.test(title);
    const minYears = anyExperience ? 0 : min !== void 0 && min >= 0 ? min : yearsIn(title);
    const experience = experienceLabel(minYears, max !== void 0 && max > 0 ? max : void 0, anyExperience);
    return [{ id: `woowahan-${number}`, company: "\uC6B0\uC544\uD55C\uD615\uC81C\uB4E4", title, source: "\uC6B0\uC544\uD55C\uD615\uC81C\uB4E4 \uCC44\uC6A9", url: `https://career.woowahan.com/recruitment/${number}/detail`, location: withRegion(title.match(/\/(서울|부산|대구|광주|대전|인천|울산|경기)/)?.[1] || ""), level: experienceLevel(`${title} ${experience}`, minYears), minYears, experience, skills: [], description: title, dueAt, postedAt: normalizeJobDate(item.recruitOpenDate), checkedAt, verification: "listing" }];
  });
}
function nextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("greeting_schema_changed");
  return obj(JSON.parse(match[1]));
}
const queries = (html) => arr(obj(obj(obj(nextData(html).props).pageProps).dehydratedState).queries);
function parseGreeting(html, host, company, checkedAt) {
  const openings = queries(html).find((q) => Array.isArray(q.queryKey) && q.queryKey[0] === "openings");
  const list = obj(openings?.state).data;
  if (!Array.isArray(list)) throw new Error("greeting_schema_changed");
  return arr(list).flatMap((item) => {
    const id = num(item.openingId), title = str(item.title).trim();
    if (!id || !title || item.deploy === false) return [];
    const dueAt = normalizeJobDate(item.dueDate);
    if (deadlinePassed(dueAt)) return [];
    const positions = arr(obj(item.openingJobPosition).openingJobPositions);
    const careers = positions.map((p) => obj(p.jobPositionCareer));
    const anyExperience = careers.some((c) => c.careerType === "NOT_MATTER");
    const newcomer = careers.some((c) => c.careerType === "NEW_COMER");
    const from = careers.map((c) => num(c.careerFrom)).filter((n) => n !== void 0);
    const minYears = anyExperience || newcomer ? 0 : from.length ? Math.min(...from) : void 0;
    const intern = positions.some((p) => obj(p.jobPositionEmployment).employmentType === "INTERN_WORKER");
    const experience = intern ? "\uC778\uD134" : newcomer && !anyExperience ? "\uC2E0\uC785" : experienceLabel(minYears, void 0, anyExperience);
    const places = [...new Set(positions.map((p) => str(obj(p.workspacePlace).place) || str(obj(p.workspacePlace).location)).filter(Boolean))];
    const occupations = [...new Set(positions.map((p) => str(obj(p.workspaceOccupation).occupation)).filter(Boolean))];
    return [{ id: `greeting-${host}-${id}`, company, title, source: `${company} \uCC44\uC6A9`, url: `https://${host}/ko/o/${id}`, location: withRegion(places.join(" \xB7 ")), level: experienceLevel(`${title} ${experience}`, minYears), minYears, experience, skills: [], description: [title, ...occupations].join("\n"), category: occupations.join(" "), dueAt, postedAt: normalizeJobDate(item.openDate), checkedAt, verification: "listing" }];
  });
}
function parseGreetingDetail(html, job, checkedAt) {
  const query = queries(html).find((q) => Array.isArray(q.queryKey) && q.queryKey[1] === "getOpeningById");
  const data = obj(obj(query?.state).data), info = obj(obj(data.data ?? data).openingsInfo);
  if (!info.openingId) return { ...job, verification: "listing" };
  if (str(info.status) !== "OPEN") return null;
  const description = plainText(info.detail);
  const minYears = job.minYears ?? yearsIn(description);
  return { ...job, description: description ? `${job.description}

${description}`.slice(0, 16e3) : job.description, minYears, checkedAt, verification: "detail" };
}
async function greeting(profile, host, company, signal) {
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  const candidates = parseGreeting(await (await request(`https://${host}/`, signal, "text/html")).text(), host, company, checkedAt);
  if (!profile) return candidates;
  const relevant = rankJobs({ ...profile, recentDays: 0 }, candidates).slice(0, 6);
  const details = await Promise.allSettled(relevant.map(async (job) => parseGreetingDetail(await (await request(job.url, signal, "text/html")).text(), candidates.find((c) => c.id === job.id), checkedAt)));
  const detailed = new Map(details.flatMap((result, i) => result.status === "fulfilled" ? [[relevant[i].id, result.value]] : []));
  return candidates.flatMap((job) => detailed.has(job.id) ? detailed.get(job.id) ? [detailed.get(job.id)] : [] : [job]);
}
async function kakao(signal) {
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString(), jobs = [];
  await Promise.all(["TECHNOLOGY", "BUSINESS_SERVICES", "DESIGN", "STAFF"].map(async (part) => {
    for (let page = 1; page <= 4; page++) {
      const data = obj(await (await request(`https://careers.kakao.com/public/api/job-list?${new URLSearchParams({ part, company: "ALL", page: String(page) })}`, signal)).json());
      jobs.push(...parseKakao(data, checkedAt));
      if (page >= (num(data.totalPage) ?? 1)) break;
    }
  }));
  return [...new Map(jobs.map((job) => [job.id, job])).values()];
}
async function naver(signal) {
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString(), jobs = [];
  for (let index = 0; index < 100; index += 10) {
    const data = obj(await (await request(`https://recruit.navercorp.com/rcrt/loadJobList.do?${new URLSearchParams({ annoId: "", sw: "", subJobCdArr: "", sysCompanyCdArr: "", empTypeCdArr: "", entTypeCdArr: "", workAreaCdArr: "", firstIndex: String(index) })}`, signal)).json());
    jobs.push(...parseNaver(data, checkedAt));
    if (index + 10 >= (num(data.totalSize) ?? 0)) break;
  }
  return jobs;
}
const GREETING_SITES = [
  ["www.musinsacareers.com", "\uBB34\uC2E0\uC0AC"],
  ["kurly.career.greetinghr.com", "\uCEEC\uB9AC"],
  ["career.oliveyoung.com", "\uC62C\uB9AC\uBE0C\uC601"],
  ["kakaopay.career.greetinghr.com", "\uCE74\uCE74\uC624\uD398\uC774"],
  ["kakaomobility.career.greetinghr.com", "\uCE74\uCE74\uC624\uBAA8\uBE4C\uB9AC\uD2F0"],
  ["career.hyundai-autoever.com", "\uD604\uB300\uC624\uD1A0\uC5D0\uBC84"],
  ["11st.career.greetinghr.com", "11\uBC88\uAC00"],
  ["zigbang.career.greetinghr.com", "\uC9C1\uBC29"],
  ["myrealtrip.career.greetinghr.com", "\uB9C8\uC774\uB9AC\uC5BC\uD2B8\uB9BD"],
  ["job.wadiz.io", "\uC640\uB514\uC988"],
  ["career.wrtn.io", "\uB93C\uD2BC"],
  ["rebellions.career.greetinghr.com", "\uB9AC\uBCA8\uB9AC\uC628"],
  ["career.spartaclub.kr", "\uD300\uC2A4\uD30C\uB974\uD0C0"],
  ["career.spoonlabs.com", "\uC2A4\uD47C\uB7A9\uC2A4"]
];
function companyProviders(profile, signal) {
  return [
    { name: "\uD1A0\uC2A4 \uCC44\uC6A9", run: async () => parseToss(await (await request("https://api-public.toss.im/api/v3/ipd-eggnog/career/jobs", signal)).json(), (/* @__PURE__ */ new Date()).toISOString()) },
    { name: "\uCE74\uCE74\uC624 \uCC44\uC6A9", run: () => kakao(signal) },
    { name: "\uB124\uC774\uBC84 \uCC44\uC6A9", run: () => naver(signal) },
    { name: "\uC6B0\uC544\uD55C\uD615\uC81C\uB4E4 \uCC44\uC6A9", run: async () => parseWoowahan(await (await request("https://career.woowahan.com/w1/recruits?recruitCampaignSeq=0&page=0&size=100&sort=updateDate%2Cdesc", signal)).json(), (/* @__PURE__ */ new Date()).toISOString()) },
    ...GREETING_SITES.map(([host, company]) => ({ name: `${company} \uCC44\uC6A9`, run: () => greeting(profile, host, company, signal) }))
  ];
}
export {
  GREETING_SITES,
  companyProviders,
  greeting,
  kakao,
  naver,
  parseGreeting,
  parseGreetingDetail,
  parseKakao,
  parseNaver,
  parseToss,
  parseWoowahan,
  withRegion
};
