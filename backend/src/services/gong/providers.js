// Adapted from https://github.com/choi0806/gong (main); TypeScript removed for the FitPoly Node server.
import { load } from "cheerio";
import { deadlinePassed, rankJobs, ROLE_RULES } from "./matching.js";
import { normalizeJobDate } from "./job-dates.js";
import { experienceLevel, fetchJobPage, parseJobPage, plainText } from "./job-page.js";
import { companyProviders, withRegion } from "./careers.js";
import { searchGemini } from "./gemini.js";
const obj = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const arr = (value) => Array.isArray(value) ? value.map(obj) : [];
const str = (value) => typeof value === "string" ? value : "";
const num = (value) => typeof value === "number" && Number.isFinite(value) ? value : void 0;
function selectDetails(profile, candidates) {
  const ranked = rankJobs({ ...profile, recentDays: 0 }, candidates);
  return (profile.sort === "latest" ? candidates.filter((job) => ranked.some((item) => item.id === job.id)) : ranked).slice(0, 16);
}
async function request(url, signal) {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(8e3)]), cache: "no-store", headers: { Accept: "application/json,text/html;q=0.9" } });
  if (!response.ok) throw new Error(`source_http_${response.status}`);
  return response;
}
function inferLevel(text, minYears) {
  return experienceLevel(text, minYears);
}
function yearsLabel(min, max) {
  if (min === 0) return max && max < 100 ? `\uC2E0\uC785~${max}\uB144` : "\uC2E0\uC785 \uC9C0\uC6D0 \uAC00\uB2A5";
  if (min !== void 0) return max && max < 100 ? `\uACBD\uB825 ${min}~${max}\uB144` : `\uACBD\uB825 ${min}\uB144 \uC774\uC0C1`;
  return "\uACBD\uB825 \uC870\uAC74 \uC6D0\uBB38 \uD655\uC778";
}
function wantedJob(item, checkedAt) {
  if (item.status !== "active" || item.hidden === true || typeof item.id !== "number" || !str(item.position) || deadlinePassed(str(item.due_time))) return null;
  const min = num(item.annual_from), max = num(item.annual_to), address = obj(item.address), detail = obj(item.detail);
  const description = [detail.main_tasks, detail.requirements, detail.preferred_points, detail.intro].map(plainText).filter(Boolean).join("\n\n");
  const category = arr(item.category_tags).map((t) => t.id === 669 ? "\uD504\uB860\uD2B8\uC5D4\uB4DC" : t.id === 872 ? "\uBC31\uC5D4\uB4DC" : "").join(" ");
  return { id: `wanted-${item.id}`, company: str(obj(item.company).name), title: str(item.position), source: "\uC6D0\uD2F0\uB4DC", url: `https://www.wanted.co.kr/wd/${item.id}`, location: [address.location, address.district].filter(Boolean).join(" ") || "\uC6D0\uBB38 \uD655\uC778", level: inferLevel(str(item.position), min), minYears: min, experience: yearsLabel(min, max), skills: arr(item.skill_tags).map((t) => str(t.title)).filter(Boolean), description: description || "\uC790\uC138\uD55C \uC5C5\uBB34\uC640 \uC790\uACA9 \uC694\uAC74\uC740 \uACF5\uACE0 \uC6D0\uBB38\uC5D0\uC11C \uD655\uC778\uD574\uC8FC\uC138\uC694.", dueAt: normalizeJobDate(item.due_time), checkedAt, category, verification: "listing", postedAt: normalizeJobDate(item.datePosted) };
}
async function wanted(profile, signal) {
  const rule = ROLE_RULES.find((r) => r.name === profile.role);
  if (!rule?.wantedTag) return [];
  const params = new URLSearchParams({ country: "kr", tag_type_ids: String(rule.wantedTag), years: profile.level === "\uC2E0\uC785" || profile.level === "\uC778\uD134" ? "0" : "-1", limit: "40", offset: "0", job_sort: "job.latest_order" });
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  const candidates = [];
  for (let page = 0; page < 3; page++) {
    params.set("offset", String(page * 40));
    const data = obj(await (await request(`https://www.wanted.co.kr/api/v4/jobs?${params}`, signal)).json());
    if (!Array.isArray(data.data)) throw new Error("wanted_schema_changed");
    candidates.push(...arr(data.data).map((item) => wantedJob(item, checkedAt)).filter((job) => !!job));
    if (!obj(data.links).next || data.data.length < 40) break;
  }
  const selected = selectDetails(profile, candidates);
  const jobs = [];
  for (let start = 0; start < selected.length; start += 4) {
    const batch = await Promise.allSettled(selected.slice(start, start + 4).map(async (candidate) => {
      const detail = obj(await (await request(`https://www.wanted.co.kr/api/v4/jobs/${candidate.id.replace("wanted-", "")}`, signal)).json());
      const job = wantedJob(obj(detail.job), checkedAt);
      if (!job) return null;
      try {
        const page = await fetchJobPage(job.url, signal);
        const metadata = parseJobPage(page.html, page.url, checkedAt, job);
        if (!metadata) return null;
        return { ...job, postedAt: metadata.postedAt, startsAt: metadata.startsAt, verification: "detail", deadlineLabel: !job.dueAt && /마감일상시채용/.test(plainText(page.html).replace(/\s/g, "")) ? "\uC0C1\uC2DC\uCC44\uC6A9" : void 0 };
      } catch {
        return { ...job, verification: "detail" };
      }
    }));
    batch.forEach((result, index) => {
      if (result.status === "fulfilled") {
        if (result.value) jobs.push(result.value);
      } else jobs.push(selected[start + index]);
    });
  }
  return jobs;
}
function parseJumpit(data, checkedAt) {
  const result = obj(obj(data).result);
  if (!Array.isArray(result.positions)) throw new Error("jumpit_schema_changed");
  return arr(result.positions).flatMap((item) => {
    if (typeof item.id !== "number" || !str(item.title) || deadlinePassed(str(item.closedAt))) return [];
    const min = num(item.minCareer), max = num(item.maxCareer);
    const skills = Array.isArray(item.techStacks) ? item.techStacks.map(plainText).filter(Boolean) : [];
    const location = Array.isArray(item.locations) ? item.locations.filter((x) => typeof x === "string").join(" \xB7 ") : "\uC6D0\uBB38 \uD655\uC778";
    return [{ id: `jumpit-${item.id}`, company: str(item.companyName), title: str(item.title), source: "\uC810\uD54F", url: `https://jumpit.saramin.co.kr/position/${item.id}`, location, level: item.newcomer === true ? inferLevel(str(item.title), 0) : inferLevel(str(item.title), min), minYears: item.newcomer === true ? 0 : min, experience: item.newcomer === true ? "\uC2E0\uC785 \uC9C0\uC6D0 \uAC00\uB2A5" : yearsLabel(min, max), skills, description: `${plainText(item.jobCategory)}
\uC0AC\uC6A9 \uAE30\uC220: ${skills.join(", ")}`, category: str(item.jobCategory), dueAt: normalizeJobDate(item.closedAt), postedAt: normalizeJobDate(item.createdAt), checkedAt, verification: "listing" }];
  });
}
async function jumpit(profile, signal) {
  if (!/개발|데이터|기획/.test(profile.role)) return [];
  const keyword = profile.skills[0] || ROLE_RULES.find((r) => r.name === profile.role)?.query || profile.role;
  const response = await request(`https://api.jumpit.co.kr/api/positions?${new URLSearchParams({ sort: "reg_dt", keyword, page: "1" })}`, signal);
  return parseJumpit(await response.json(), (/* @__PURE__ */ new Date()).toISOString());
}
function parseJobkorea(html, checkedAt) {
  const $ = load(html);
  const cards = $('[data-sentry-component="CardJob"]');
  if (!cards.length && !/검색\s*결과가\s*없|검색된\s*공고가\s*없/.test($.text())) throw new Error("jobkorea_schema_changed");
  return cards.toArray().flatMap((element) => {
    const card = $(element), titleLink = card.find('[data-sentry-component="Title"]').first();
    const title = titleLink.text().trim(), href = titleLink.attr("href");
    if (!title || !href) return [];
    let url;
    try {
      url = new URL(href, "https://www.jobkorea.co.kr");
    } catch {
      return [];
    }
    if (url.protocol !== "https:" || url.hostname !== "www.jobkorea.co.kr" || !/^\/Recruit\/GI_Read\/\d+$/i.test(url.pathname)) return [];
    const text = card.text().replace(/스크랩/g, "");
    if (/접수\s*마감|모집\s*마감|채용\s*마감|마감된\s*공고/.test(text)) return [];
    const company = card.find('[data-sentry-component="CompanyLogo"] img').attr("alt")?.replace(/\s*로고$/, "") || card.find(".text-typo-b2-16").first().text().trim();
    const chips = card.find('[data-sentry-component="GrayChip"]').toArray().map((chip) => $(chip).text().trim());
    const experience = card.find("span.flex-shrink-0.text-gray700").first().text().trim() || "\uACBD\uB825 \uC870\uAC74 \uC6D0\uBB38 \uD655\uC778";
    const min = experience.match(/(?:경력\s*)?(\d+)\s*년/);
    const minYears = /경력\s*무관|신입/.test(experience) ? 0 : min ? Number(min[1]) : void 0;
    return [{ id: `jobkorea-${url.pathname.split("/").pop()}`, company, title, source: "\uC7A1\uCF54\uB9AC\uC544", url: `${url.origin}${url.pathname}`, location: chips[0] || "\uC6D0\uBB38 \uD655\uC778", level: inferLevel(`${title} ${experience}`, minYears), minYears, experience, skills: [], description: `${title}
${chips.slice(1).join(" \xB7 ")}
${experience}`, category: chips.slice(1).join(" "), checkedAt }];
  });
}
async function jobkorea(profile, signal) {
  const query = `${ROLE_RULES.find((r) => r.name === profile.role)?.query || profile.role} ${profile.level === "\uC804\uCCB4" ? "" : profile.level}`.trim();
  const candidates = parseJobkorea(await (await request(`https://www.jobkorea.co.kr/Search/?${new URLSearchParams({ stext: query, ord: "2" })}`, signal)).text(), (/* @__PURE__ */ new Date()).toISOString());
  const selected = selectDetails(profile, candidates);
  const jobs = [];
  for (let i = 0; i < selected.length; i += 4) {
    const results = await Promise.allSettled(selected.slice(i, i + 4).map(async (job) => {
      const page = await fetchJobPage(job.url, signal);
      return parseJobPage(page.html, page.url, (/* @__PURE__ */ new Date()).toISOString(), job);
    }));
    results.forEach((r, index) => {
      if (r.status === "fulfilled") {
        if (r.value) jobs.push(r.value);
      } else jobs.push({ ...selected[i + index], verification: "listing" });
    });
  }
  return jobs;
}
function parseSaramin(html, checkedAt) {
  const $ = load(html), cards = $(".item_recruit");
  if (!cards.length && !/검색\s*결과가\s*없|검색된\s*채용정보가\s*없/.test($.text())) throw new Error("saramin_schema_changed");
  return cards.toArray().flatMap((element) => {
    const card = $(element), link = card.find(".job_tit a").first();
    let url;
    try {
      url = new URL(link.attr("href") || "", "https://www.saramin.co.kr");
    } catch {
      return [];
    }
    const id = url.searchParams.get("rec_idx");
    if (url.hostname !== "www.saramin.co.kr" || !id || !/^\d+$/.test(id)) return [];
    const title = link.text().trim(), company = card.find(".corp_name").text().trim();
    if (!title || !company) return [];
    const conditions = card.find(".job_condition > span").toArray().map((el) => $(el).text().trim());
    const experience = conditions[1] || "\uACBD\uB825 \uC870\uAC74 \uC6D0\uBB38 \uD655\uC778";
    const minYears = /신입|경력\s*무관/.test(experience) ? 0 : Number(experience.match(/(\d+)\s*년/)?.[1]) || void 0;
    const dateText = card.find(".job_date .date").text().trim();
    if (/^마감$|접수\s*마감/.test(dateText)) return [];
    const day = card.find(".job_day").text();
    const date = day.match(/등록일\s*(\d{2})\/(\d{2})\/(\d{2})/);
    return [{ id: `saramin-${id}`, title, company, source: "\uC0AC\uB78C\uC778", url: `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${id}`, location: conditions[0] || "\uC6D0\uBB38 \uD655\uC778", level: inferLevel(`${title} ${experience} ${conditions.slice(2).join(" ")}`, minYears), minYears, experience, skills: [], description: `${title}
${conditions.join(" \xB7 ")}
${card.find(".job_sector").text().trim()}`, postedAt: date ? normalizeJobDate(`20${date[1]}-${date[2]}-${date[3]}`) : void 0, deadlineLabel: dateText || void 0, checkedAt, verification: "listing" }];
  });
}
async function saramin(profile, signal) {
  const query = `${ROLE_RULES.find((r) => r.name === profile.role)?.query || profile.role} ${profile.level === "\uC804\uCCB4" ? "" : profile.level}`.trim();
  const params = new URLSearchParams({ searchword: query, recruitSort: "reg_dt", recruitPageCount: "40" });
  const candidates = parseSaramin(await (await request(`https://www.saramin.co.kr/zf_user/search/recruit?${params}`, signal)).text(), (/* @__PURE__ */ new Date()).toISOString());
  const selected = selectDetails(profile, candidates);
  const jobs = [];
  for (let i = 0; i < selected.length; i += 4) {
    const responses = await Promise.allSettled(selected.slice(i, i + 4).map(async (job) => {
      const page = await fetchJobPage(job.url, signal);
      return parseJobPage(page.html, page.url, (/* @__PURE__ */ new Date()).toISOString(), job);
    }));
    responses.forEach((r, index) => {
      if (r.status === "fulfilled") {
        if (r.value) jobs.push(r.value);
      } else jobs.push(selected[i + index]);
    });
  }
  return jobs;
}
function parseGreenhouse(data, board, company, checkedAt) {
  if (!Array.isArray(obj(data).jobs)) throw new Error("greenhouse_schema_changed");
  return arr(obj(data).jobs).flatMap((item) => {
    const location = str(obj(item.location).name);
    if (!/seoul|korea|서울|한국|성남|판교|대한민국/i.test(location) || !num(item.id) || !str(item.title)) return [];
    const metadata = arr(item.metadata);
    const meta = (name) => str(metadata.find((m) => m.name === name)?.value);
    const dueAt = normalizeJobDate(item.application_deadline) || normalizeJobDate(meta("Valid Through"));
    if (deadlinePassed(dueAt)) return [];
    const description = plainText(item.content);
    const years = description.match(/(\d+)\s*(?:년|\+?\s*years?)\s*(?:이상|or more|of experience)/i);
    const minYears = years ? Number(years[1]) : void 0;
    const explicit = `${str(item.title)} ${meta("Prior Experience")} ${meta("Employment Type")}`;
    return [{ id: `${board}-${item.id}`, company: meta("Corporate") || company, title: str(item.title).trim(), source: `${company} \uCC44\uC6A9`, url: board === "daangn" ? `https://careers.daangn.com/jobs/role/${item.id}/` : `https://job-boards.greenhouse.io/${board}/jobs/${item.id}`, location: withRegion(location.replace(/Seoul, South Korea|SEOUL|Seoul/gi, "\uC11C\uC6B8")), level: inferLevel(explicit, minYears), minYears, experience: meta("Prior Experience") || (minYears ? `\uACBD\uB825 ${minYears}\uB144 \uC774\uC0C1` : inferLevel(explicit) === "\uC778\uD134" ? "\uC778\uD134" : "\uACBD\uB825 \uC870\uAC74 \uC6D0\uBB38 \uD655\uC778"), skills: [], description, dueAt, checkedAt, verification: "detail", postedAt: normalizeJobDate(item.first_published) }];
  });
}
const GREENHOUSE_BOARDS = [["daangn", "\uB2F9\uADFC"], ["sendbird", "\uC13C\uB4DC\uBC84\uB4DC"], ["moloco", "\uBAB0\uB85C\uCF54"], ["coupang", "\uCFE0\uD321"], ["krafton", "\uD06C\uB798\uD504\uD1A4"]];
async function greenhouse(board, company, signal) {
  const data = await (await request(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, signal)).json();
  return parseGreenhouse(data, board, company, (/* @__PURE__ */ new Date()).toISOString());
}
async function searchLiveJobs(profile, skip = /* @__PURE__ */ new Set()) {
  const signal = AbortSignal.timeout(45e3);
  const providers = [
    { name: "\uC6D0\uD2F0\uB4DC", run: () => wanted(profile, signal) },
    { name: "\uC7A1\uCF54\uB9AC\uC544", run: () => jobkorea(profile, signal) },
    { name: "\uC0AC\uB78C\uC778", run: () => saramin(profile, signal) },
    { name: "\uC810\uD54F", run: () => jumpit(profile, signal) },
    ...GREENHOUSE_BOARDS.map(([board, company]) => ({ name: `${company} \uCC44\uC6A9`, run: () => greenhouse(board, company, signal) })),
    ...companyProviders(profile, signal)
  ].filter((provider) => !skip.has(provider.name)).filter((provider) => provider.name === "\uC6D0\uD2F0\uB4DC" ? !!ROLE_RULES.find((rule) => rule.name === profile.role)?.wantedTag : provider.name === "\uC810\uD54F" ? /개발|데이터|기획/.test(profile.role) : true);
  const [responses, gemini] = await Promise.all([Promise.allSettled(providers.map((provider) => provider.run())), searchGemini(profile, signal)]);
  const sources = responses.map((response, index) => ({ name: providers[index].name, status: response.status === "fulfilled" ? "ok" : "failed", count: response.status === "fulfilled" ? response.value.length : 0 }));
  const jobs = rankJobs(profile, [...responses.flatMap((response) => response.status === "fulfilled" ? response.value : []), ...gemini.jobs]);
  const failures = sources.filter((source) => source.status === "failed");
  return { jobs, sources: [...sources, gemini.source], searchSuggestions: gemini.searchSuggestions, checkedAt: (/* @__PURE__ */ new Date()).toISOString(), message: (failures.length === sources.length && gemini.source.status !== "ok" ? "\uCC44\uC6A9 \uC0AC\uC774\uD2B8\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uCC3E\uC544\uC8FC\uC138\uC694." : failures.length ? `${failures.slice(0, 3).map((source) => source.name).join(", ")}${failures.length > 3 ? ` \uB4F1 ${failures.length}\uAC1C \uCC44\uB110` : ""}\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD574 \uB098\uBA38\uC9C0 \uCC44\uB110\uC5D0\uC11C \uCC3E\uC558\uC5B4\uC694.` : jobs.length ? "\uACF5\uAC1C \uCC44\uC6A9 \uBAA9\uB85D\uACFC \uD655\uC778 \uAC00\uB2A5\uD55C \uC6D0\uBB38\uC5D0\uC11C \uCC3E\uC558\uC5B4\uC694." : "\uD604\uC7AC \uAC80\uC0C9 \uBC94\uC704\uC5D0\uC11C \uC870\uAC74\uC5D0 \uB9DE\uB294 \uACF5\uACE0\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694.") + " \uC804\uCCB4 \uC0AC\uC774\uD2B8\xB7\uC804\uCCB4 \uACF5\uACE0\uB97C \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC73C\uBA70, \uBBF8\uD655\uC778 \uC811\uC218 \uAE30\uAC04\uC740 \uC6D0\uBB38 \uD655\uC778\uC774 \uD544\uC694\uD574\uC694." };
}
export {
  GREENHOUSE_BOARDS,
  greenhouse,
  inferLevel,
  parseGreenhouse,
  parseJobkorea,
  parseJumpit,
  parseSaramin,
  plainText,
  searchLiveJobs,
  wantedJob
};
