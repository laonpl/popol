import test from "node:test";
import assert from "node:assert/strict";
import { deadlinePassed, rankJobs, validateProfile } from "../matching.js";
import { dateTime, displayDate, normalizeJobDate } from "../job-dates.js";
import { discoverJobLinks, parseJobPage, safeJobUrl, fetchJobPage, experienceLevel } from "../job-page.js";
import { parseSaramin } from "../providers.js";
import { parseGrounding, resolveGroundingUrl, searchGemini } from "../gemini.js";
const profile = { role: "\uD504\uB860\uD2B8\uC5D4\uB4DC \uAC1C\uBC1C\uC790", skills: ["React"], level: "\uC804\uCCB4", location: "\uC804\uAD6D" };
const base = { id: "1", company: "\uAE30\uC5C5", title: "Frontend Engineer", source: "\uC7A1\uCF54\uB9AC\uC544", url: "https://www.jobkorea.co.kr/Recruit/GI_Read/123", location: "\uC11C\uC6B8", level: "\uC2E0\uC785", minYears: 0, skills: ["React"], description: "React", postedAt: "2026-09-28" };
const now = Date.parse("2026-09-29T10:00:00+09:00");
const page = (fields = {}, body = "\uC2DC\uC791\uC77C 2026.09.20") => `<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Frontend Engineer", hiringOrganization: { name: "\uAE30\uC5C5" }, description: "React", datePosted: "2026-09-28", validThrough: "2099-10-01T18:00", experienceRequirements: "\uC2E0\uC785", jobLocation: { address: { addressRegion: "\uC11C\uC6B8" } }, ...fields })}<\/script><main>${body}</main>`;
test("KST date boundaries, leap days, malformed dates and explicit time zones", () => {
  assert.equal(normalizeJobDate("2026.09.29"), "2026-09-29");
  for (const date of ["2026-02-29", "2026-13-01", "09/29", "\uCC44\uC6A9\uC2DC \uB9C8\uAC10", "2026-09-29T99:99"]) assert.equal(normalizeJobDate(date), void 0);
  assert.equal(normalizeJobDate("2028-02-29"), "2028-02-29");
  assert.equal(deadlinePassed("2026-09-29", Date.parse("2026-09-29T23:59:59+09:00")), false);
  assert.equal(deadlinePassed("2026-09-29", Date.parse("2026-09-30T00:00:00+09:00")), true);
  assert.equal(deadlinePassed("2026-09-29 18:00", Date.parse("2026-09-29T18:00:00+09:00")), true);
  assert.equal(dateTime("2026-09-29T09:00Z"), dateTime("2026-09-29T18:00+09:00"));
  assert.match(displayDate("2026-12-31T16:00Z"), /2027/);
});
test("intern, new graduate, unknown, experienced and freelance are distinct", () => {
  const jobs = [base, { ...base, id: "intern", title: "Frontend Intern", level: "\uC778\uD134" }, { ...base, id: "senior", title: "Senior Frontend", level: "\uACBD\uB825", minYears: 3 }, { ...base, id: "unknown", title: "Frontend unknown", level: "\uC804\uCCB4", minYears: void 0 }, { ...base, id: "any", title: "Frontend any", level: "\uC804\uCCB4" }, { ...base, id: "free", title: "Frontend freelance", level: "\uD504\uB9AC\uB79C\uC11C" }];
  assert.deepEqual(rankJobs({ ...profile, level: "\uC778\uD134" }, jobs, now).map((j) => j.id), ["intern"]);
  assert.deepEqual(rankJobs({ ...profile, level: "\uC2E0\uC785" }, jobs, now).map((j) => j.id), ["1", "any"]);
  assert.deepEqual(rankJobs({ ...profile, level: "\uACBD\uB825", years: 2 }, jobs, now).map((j) => j.id), ["any"]);
  assert.deepEqual(rankJobs({ ...profile, level: "\uD504\uB9AC\uB79C\uC11C" }, jobs, now).map((j) => j.id), ["free"]);
  assert.equal(experienceLevel("\uC2E0\uC785 \uBC0F \uACBD\uB825"), "\uC804\uCCB4");
  assert.equal(experienceLevel("\uACBD\uB825 \uC870\uAC74 \uC6D0\uBB38 \uD655\uC778"), "\uC804\uCCB4");
});
test("recent filters use posted dates only, sort chronologically and exclude future opening", () => {
  const jobs = [base, { ...base, id: "older", company: "B", postedAt: "2026-09-01" }, { ...base, id: "unknown", company: "C", postedAt: void 0, checkedAt: new Date(now).toISOString() }, { ...base, id: "today", company: "D", postedAt: "2026-09-29" }, { ...base, id: "future", company: "E", startsAt: "2026-10-01" }];
  assert.deepEqual(rankJobs({ ...profile, recentDays: 7, sort: "latest" }, jobs, now).map((j) => j.id), ["today", "1"]);
  assert.equal(rankJobs({ ...profile, location: "\uBD80\uC0B0" }, jobs, now).length, 0);
  assert.equal(validateProfile({ ...profile, recentDays: -1 }), null);
  assert.equal(validateProfile({ ...profile, sort: "bad" }), null);
});
test("Flutter and mobile titles are not web frontend roles just because a category includes frontend", () => {
  for (const title of ["Flutter\uAC1C\uBC1C \uCC44\uC6A9\uC804\uD658\uD615 \uC778\uD134", "\uBAA8\uBC14\uC77C \uC5D4\uC9C0\uB2C8\uC5B4 (React Native, NextJS)", "React Native Engineer"]) {
    assert.equal(rankJobs(profile, [{ ...base, title, category: "\uD504\uB860\uD2B8\uC5D4\uB4DC" }], now).length, 0);
  }
});
test("detail parsing reads source dates and preserves exact deadline hour", () => {
  const job = parseJobPage(page(), base.url, new Date(now).toISOString(), base);
  assert.equal(job.dueAt, "2099-10-01T18:00+09:00");
  assert.equal(job.postedAt, "2026-09-28");
  assert.equal(job.startsAt, "2026-09-20");
  assert.equal(job.verification, "detail");
  assert.equal(parseJobPage(page({ validThrough: "2020-01-01" }), base.url, ""), null);
  assert.equal(parseJobPage(page({}, "\uB9C8\uAC10\uB41C \uACF5\uACE0\uC785\uB2C8\uB2E4"), base.url, ""), null);
  assert.equal(parseJobPage(page() + page(), base.url, ""), null);
  assert.equal(parseJobPage("<h1>\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4</h1>", base.url, ""), null);
});
test("Saramin preserves unknown deadline year instead of inventing an exact date", () => {
  const html = `<div class="item_recruit"><h2 class="job_tit"><a href="/zf_user/jobs/relay/view?rec_idx=123">\uD504\uB860\uD2B8\uC5D4\uB4DC \uC778\uD134</a></h2><b class="corp_name">\uAE30\uC5C5</b><div class="job_condition"><span>\uC11C\uC6B8</span><span>\uC2E0\uC785</span><span>\uC778\uD134</span></div><div class="job_date"><span class="date">~ 01/03</span></div><span class="job_day">\uB4F1\uB85D\uC77C 26/12/29</span></div>`;
  const job = parseSaramin(html, "2026-12-30")[0];
  assert.equal(job.level, "\uC778\uD134");
  assert.equal(job.postedAt, "2026-12-29");
  assert.equal(job.dueAt, void 0);
  assert.equal(job.deadlineLabel, "~ 01/03");
});
test("Saramin detail extracts hours from reception section, not dates in other content", () => {
  const html = `<div class="jv_header" data-rec_idx="123"><h1 class="tit_job">\uD504\uB860\uD2B8\uC5D4\uB4DC \uC778\uD134</h1><a class="company">\uAE30\uC5C5</a></div><div class="jv_summary"><dt>\uACBD\uB825</dt><dd>\uC2E0\uC785</dd></div><div class="jv_detail"><div class="user_content">\uD68C\uC0AC \uC124\uB9BD\uC77C 2001.01.01</div></div><div class="jv_howto"><div class="status"><dl class="info_period"><dt>\uC2DC\uC791\uC77C</dt><dd>2026.09.20 09:00</dd><dt>\uB9C8\uAC10\uC77C</dt><dd>2099.10.05 18:30</dd></dl></div></div>`;
  const job = parseJobPage(html, "https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=123", "2026-09-29", { ...base, postedAt: "2026-09-19" });
  assert.equal(job.startsAt, "2026-09-20T09:00+09:00");
  assert.equal(job.dueAt, "2099-10-05T18:30+09:00");
  assert.equal(job.postedAt, "2026-09-19");
  assert.equal(job.level, "\uC778\uD134");
  assert.equal(parseJobPage(html, "https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=999", ""), null);
});
test("Wanted date precision from API overrides midnight JSON-LD and arrays include newcomer", () => {
  const job = parseJobPage(page({ validThrough: "2099-10-01T00:00", experienceRequirements: ["\uC2E0\uC785", "\uACBD\uB825"] }), "https://www.wanted.co.kr/wd/123", "", { ...base, dueAt: "2099-10-01" });
  assert.equal(job.dueAt, "2099-10-01");
  assert.equal(job.minYears, 0);
  assert.equal(job.level, "\uC804\uCCB4");
});
test("search ignores generated URLs without grounding and blocks internal or unknown hosts", async () => {
  assert.throws(() => parseGrounding({ candidates: [{ content: { parts: [{ text: base.url }] } }] }));
  assert.deepEqual(parseGrounding({ candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: base.url } }, { web: { uri: base.url } }] } }] }).urls, [base.url]);
  for (const url of ["http://www.jobkorea.co.kr/a", "https://127.0.0.1/a", "https://www.jobkorea.co.kr.evil.test/a", "https://x@www.jobkorea.co.kr/a", "https://www.jobkorea.co.kr:123/a"]) assert.equal(safeJobUrl(url), null);
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } });
  };
  try {
    await assert.rejects(fetchJobPage(base.url, AbortSignal.timeout(1e3)));
    assert.equal(await resolveGroundingUrl("https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", AbortSignal.timeout(1e3)), null);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
test("Gemini uses free model, deduplicates concurrent calls, caches, and verifies source pages", async () => {
  const original = globalThis.fetch, old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-success";
  let apiCalls = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("generativelanguage")) {
      apiCalls++;
      assert.match(String(input), /gemini-2.5-flash:generateContent/);
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.tools, [{ google_search: {} }]);
      assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
      assert.equal(String(input).includes("test-key"), false);
      return Response.json({ candidates: [{ finishReason: "STOP", groundingMetadata: { groundingChunks: [{ web: { uri: base.url } }] } }] });
    }
    return new Response(page());
  };
  try {
    const [a, b] = await Promise.all([searchGemini(profile, AbortSignal.timeout(1e3)), searchGemini(profile, AbortSignal.timeout(1e3))]);
    assert.equal(a.jobs.length, 1);
    assert.equal(b.jobs.length, 1);
    await searchGemini({ ...profile, sort: "latest", recentDays: 7 }, AbortSignal.timeout(1e3));
    assert.equal(apiCalls, 1);
  } finally {
    globalThis.fetch = original;
    if (old === void 0) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = old;
  }
});
test("Gemini 429 does not retry or leak upstream messages and enters cooldown", async () => {
  const original = globalThis.fetch, old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-quota";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ secret: "upstream-private-text" }, { status: 429, headers: { "retry-after": "120" } });
  };
  try {
    const a = await searchGemini(profile, AbortSignal.timeout(1e3));
    const b = await searchGemini(profile, AbortSignal.timeout(1e3));
    assert.equal(a.source.status, "failed");
    assert.match(a.source.message, /한도/);
    assert.equal(b.source.status, "skipped");
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(a).includes("upstream-private-text"), false);
  } finally {
    globalThis.fetch = original;
    if (old === void 0) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = old;
  }
});
test("grounded listings discover only bounded same-host detail links and normalize tracking", () => {
  const html = `<a href="/Recruit/GI_Read/123?tracking=one">\uACF5\uACE0</a><a href="/Recruit/GI_Read/123?tracking=two">\uC911\uBCF5</a><a href="/Search/?q=react">\uBAA9\uB85D</a><a href="https://evil.test/Recruit/GI_Read/456">\uC678\uBD80</a><a href="https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=456">\uB2E4\uB978 \uC0AC\uC774\uD2B8</a>`;
  assert.deepEqual(discoverJobLinks(html, "https://www.jobkorea.co.kr/Search"), ["https://www.jobkorea.co.kr/Recruit/GI_Read/123"]);
  assert.equal(discoverJobLinks(Array.from({ length: 10 }, (_, i) => `<a href="/wd/${i}">\uACF5\uACE0</a>`).join(""), "https://www.wanted.co.kr/wdlist/518").length, 4);
  assert.equal(safeJobUrl("https://m.jobkorea.co.kr/Recruit/GI_Read/123")?.href, "https://www.jobkorea.co.kr/Recruit/GI_Read/123");
  assert.equal(safeJobUrl("https://m.jobkorea.co.kr/unrelated"), null);
  assert.equal(safeJobUrl("https://m.jobkorea.co.kr:123/Recruit/GI_Read/123"), null);
});
test("Gemini follows links from a grounded listing and still requires genuine JobPosting data", async () => {
  const original = globalThis.fetch, old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-listing";
  globalThis.fetch = async (input) => {
    if (String(input).includes("generativelanguage")) return Response.json({ candidates: [{ finishReason: "STOP", groundingMetadata: { groundingChunks: [{ web: { uri: "https://www.jobkorea.co.kr/Search" } }] } }] });
    if (String(input).includes("/Search")) return new Response(`<a href="/Recruit/GI_Read/123">\uACF5\uACE0</a><a href="/Recruit/GI_Read/456">\uB85C\uADF8\uC778 \uD398\uC774\uC9C0</a>`);
    return new Response(String(input).endsWith("/123") ? page() : "<h1>\uB85C\uADF8\uC778</h1>");
  };
  try {
    const result = await searchGemini(profile, AbortSignal.timeout(1e3));
    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0].url, base.url);
    assert.match(result.source.message, /상세 링크 2개/);
  } finally {
    globalThis.fetch = original;
    if (old === void 0) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = old;
  }
});
