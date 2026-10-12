// Adapted from https://github.com/choi0806/gong (main); TypeScript removed for the FitPoly Node server.
import { load } from "cheerio";
import { normalizeJobDate } from "./job-dates.js";
import { deadlinePassed } from "./matching.js";
const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const string = (value) => typeof value === "string" ? value : "";
function plainText(value) {
  let text = string(value);
  for (let i = 0; i < 2; i++) text = load(text.replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi, "\n")).text();
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function textContent(value) {
  return load(string(value)).text().replace(/\s+/g, " ").trim();
}
function experienceLevel(text, minYears) {
  text = text.replace(/경력 조건 원문 확인/g, "");
  if (/프리랜서|freelance/i.test(text)) return "\uD504\uB9AC\uB79C\uC11C";
  if (/인턴|\bintern\b|internship/i.test(text)) return "\uC778\uD134";
  if (/경력\s*무관|신입\s*[·/,~및&+\s]+경력|신입.*지원\s*가능/i.test(text)) return "\uC804\uCCB4";
  if (minYears !== void 0 && minYears > 0) return "\uACBD\uB825";
  if (/신입|new.?grad|entry.?level/i.test(text)) return "\uC2E0\uC785";
  if (/경력|senior|\bstaff\b|\blead\b|[1-9]\s*년\s*(?:이상|차)/i.test(text)) return "\uACBD\uB825";
  return "\uC804\uCCB4";
}
const hosts = ["www.wanted.co.kr", "wanted.co.kr", "www.jobkorea.co.kr", "www.saramin.co.kr", "jumpit.saramin.co.kr", "www.jobplanet.co.kr", "www.incruit.com", "job.incruit.com", "www.rocketpunch.com", "www.rallit.com", "rallit.com", "www.jobda.im", "www.catch.co.kr", "linkareer.com", "www.jobaba.net", "careers.daangn.com", "job-boards.greenhouse.io", "boards.greenhouse.io", "jobs.lever.co", "jobs.ashbyhq.com", "careers.toss.im", "recruit.navercorp.com", "careers.kakao.com"];
function safeJobUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname === "m.jobkorea.co.kr" && /^\/Recruit\/GI_Read\/\d+\/?$/i.test(url.pathname)) url.hostname = "www.jobkorea.co.kr";
    return url.protocol === "https:" && !url.username && !url.password && !url.port && hosts.includes(url.hostname) ? url : null;
  } catch {
    return null;
  }
}
function discoverJobLinks(html, pageUrl) {
  const page = safeJobUrl(pageUrl);
  if (!page) return [];
  const $ = load(html), links = /* @__PURE__ */ new Set();
  $("a[href]").each((_, el) => {
    let url;
    try {
      url = safeJobUrl(new URL($(el).attr("href"), page).href);
    } catch {
      return;
    }
    if (!url || url.hostname !== page.hostname) return;
    if (url.hostname.endsWith("wanted.co.kr") && /^\/wd\/\d+\/?$/.test(url.pathname)) url.search = "";
    else if (url.hostname === "www.jobkorea.co.kr" && /^\/Recruit\/GI_Read\/\d+\/?$/i.test(url.pathname)) url.search = "";
    else if (url.hostname === "www.saramin.co.kr" && /^\/zf_user\/jobs\/(?:relay\/)?view$/.test(url.pathname) && /^\d+$/.test(url.searchParams.get("rec_idx") || "")) {
      const id = url.searchParams.get("rec_idx");
      url.pathname = "/zf_user/jobs/view";
      url.search = new URLSearchParams({ rec_idx: id }).toString();
    } else return;
    url.hash = "";
    links.add(url.href);
  });
  return [...links].slice(0, 4);
}
async function fetchJobPage(value, signal) {
  let url = safeJobUrl(value);
  if (url?.hostname === "www.saramin.co.kr" && url.pathname === "/zf_user/jobs/relay/view") url.pathname = "/zf_user/jobs/view";
  for (let hop = 0; url && hop < 4; hop++) {
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(7e3)]), redirect: "manual", cache: "no-store", headers: { Accept: "text/html,application/xhtml+xml" } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      url = location ? safeJobUrl(new URL(location, url).href) : null;
      continue;
    }
    if (!response.ok) throw new Error(`source_http_${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("empty_page");
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 4e6) throw new Error("page_too_large");
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel();
    }
    return { html: Buffer.concat(chunks).toString("utf8"), url: url.href };
  }
  throw new Error("unsupported_job_url");
}
function parseJobPage(html, url, checkedAt, fallback) {
  if (!safeJobUrl(url)) return null;
  const $ = load(html);
  const nodes = [];
  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const item = record(value);
    if (item["@type"] === "JobPosting" || Array.isArray(item["@type"]) && item["@type"].includes("JobPosting")) nodes.push(item);
    if (item["@graph"]) visit(item["@graph"]);
  }
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      visit(JSON.parse($(element).text()));
    } catch {
    }
  });
  if (nodes.length === 0 && new URL(url).hostname === "www.saramin.co.kr") {
    const header = $(".jv_header").first();
    const id = header.attr("data-rec_idx"), title = header.find(".tit_job").text().trim(), company = header.find(".company").text().trim();
    if (!id || !title || !company || id !== new URL(url).searchParams.get("rec_idx")) return null;
    const period = $(".jv_howto .info_period");
    const getPeriod = (name) => period.find("dt").filter((_, el) => $(el).text().trim() === name).next("dd").text().trim();
    const dueAt2 = normalizeJobDate(getPeriod("\uB9C8\uAC10\uC77C"));
    if (deadlinePassed(dueAt2) || /접수\s*마감|마감된\s*공고/.test($(".jv_howto .status").text())) return null;
    const summary = $(".jv_summary");
    const experience = summary.find("dt").filter((_, el) => $(el).text().trim() === "\uACBD\uB825").next("dd").text().trim() || fallback?.experience || "\uACBD\uB825 \uC870\uAC74 \uC6D0\uBB38 \uD655\uC778";
    const employment = summary.find("dt").filter((_, el) => $(el).text().trim() === "\uADFC\uBB34\uD615\uD0DC").next("dd").text().trim();
    const minYears2 = /신입|경력\s*무관/.test(experience) ? 0 : Number(experience.match(/(\d+)\s*년/)?.[1]) || void 0;
    return { ...fallback, id: `saramin-${id}`, title, company, source: "\uC0AC\uB78C\uC778", url, skills: fallback?.skills || [], location: $(".jv_location").attr("data-address") || fallback?.location || "\uC6D0\uBB38 \uD655\uC778", experience, minYears: minYears2, level: experienceLevel(`${title} ${experience} ${employment}`, minYears2), description: $(".jv_detail .user_content").text().replace(/\s+/g, " ").trim().slice(0, 16e3) || fallback?.description || title, startsAt: normalizeJobDate(getPeriod("\uC2DC\uC791\uC77C")), dueAt: dueAt2, deadlineLabel: dueAt2 ? void 0 : getPeriod("\uB9C8\uAC10\uC77C") || fallback?.deadlineLabel, checkedAt, verification: "detail" };
  }
  if (nodes.length !== 1) return null;
  const data = nodes[0];
  if (!string(data.title) || !string(record(data.hiringOrganization).name)) return null;
  $("script,style,nav,header,footer").remove();
  const body = $.text().replace(/\s+/g, " ");
  if (/접수가\s*마감|마감된\s*공고|모집이\s*마감|채용이\s*종료/.test(body)) return null;
  const dueAt = new URL(url).hostname.endsWith("wanted.co.kr") && fallback?.dueAt ? fallback.dueAt : normalizeJobDate(data.validThrough);
  if (deadlinePassed(dueAt)) return null;
  const locationData = Array.isArray(data.jobLocation) ? data.jobLocation : [data.jobLocation];
  const location = locationData.map((item) => {
    const a = record(record(item).address);
    return [a.addressRegion, a.addressLocality, a.streetAddress].filter(Boolean).join(" ");
  }).filter(Boolean).join(" \xB7 ");
  const exp = Array.isArray(data.experienceRequirements) ? data.experienceRequirements.map(string).join("\xB7") : typeof data.experienceRequirements === "string" ? data.experienceRequirements : string(record(data.experienceRequirements).description);
  const months = record(data.experienceRequirements).monthsOfExperience;
  const years = (exp + " " + (fallback?.experience || "")).match(/(\d+)\s*년/);
  const minYears = /신입|경력\s*무관/.test(exp) ? 0 : typeof months === "number" ? months / 12 : years ? Number(years[1]) : fallback?.minYears;
  const types = Array.isArray(data.employmentType) ? data.employmentType.join(" ") : string(data.employmentType);
  const level = experienceLevel(`${data.title} ${exp} ${/INTERN|인턴/i.test(types) ? "\uC778\uD134" : ""} ${/프리랜서/i.test(types) ? "\uD504\uB9AC\uB79C\uC11C" : ""}`, minYears);
  const startsAt = normalizeJobDate(body.match(/시작일\s*(\d{4}[.-]\d{2}[.-]\d{2})/)?.[1]);
  return { ...fallback, id: fallback?.id || `web-${new URL(url).hostname}-${string(record(data.identifier).value) || new URL(url).pathname}`, title: textContent(data.title), company: textContent(record(data.hiringOrganization).name), source: fallback?.source || ({ "www.jobkorea.co.kr": "\uC7A1\uCF54\uB9AC\uC544", "www.saramin.co.kr": "\uC0AC\uB78C\uC778", "www.wanted.co.kr": "\uC6D0\uD2F0\uB4DC" }[new URL(url).hostname] || new URL(url).hostname), url, description: textContent(data.description), location: location || fallback?.location || "\uC6D0\uBB38 \uD655\uC778", skills: fallback?.skills || [], level, minYears, experience: fallback?.experience || exp || (level === "\uC804\uCCB4" ? "\uACBD\uB825 \uC870\uAC74 \uC6D0\uBB38 \uD655\uC778" : level), postedAt: normalizeJobDate(data.datePosted), startsAt, dueAt, deadlineLabel: dueAt ? void 0 : /채용시\s*마감/.test(body) ? "\uCC44\uC6A9 \uC2DC \uB9C8\uAC10" : void 0, checkedAt, verification: "detail" };
}
export {
  discoverJobLinks,
  experienceLevel,
  fetchJobPage,
  parseJobPage,
  plainText,
  record,
  safeJobUrl,
  string,
  textContent
};
