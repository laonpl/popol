// Adapted from https://github.com/choi0806/gong (main); TypeScript removed for the FitPoly Node server.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { deadlinePassed, ROLE_RULES } from "./matching.js";
import { GREENHOUSE_BOARDS, greenhouse, parseSaramin, wantedJob } from "./providers.js";
import { companyProviders, parseGreetingDetail } from "./careers.js";
import { fetchJobPage, parseJobPage, record as obj } from "./job-page.js";
const indexFile = () => process.env.JOB_INDEX_FILE || path.join(process.cwd(), "data", "job-index.json");
const TTL = (Number(process.env.JOB_INDEX_TTL_HOURS) || 6) * 36e5;
const SARAMIN_PAGES = Number(process.env.JOB_INDEX_SARAMIN_PAGES) || 30;
const VERSION = 1;
const holder = globalThis;
const state = holder.gongchatIndex ??= { groups: /* @__PURE__ */ new Map(), flat: [] };
const arr = (value) => Array.isArray(value) ? value.map(obj) : [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(url, signal, accept = "application/json") {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15e3)]), cache: "no-store", headers: { Accept: accept, "User-Agent": "Mozilla/5.0 (compatible; gongchat-indexer)" } });
  if (!response.ok) throw new Error(`source_http_${response.status}`);
  return response;
}
function rebuild() {
  const seen = /* @__PURE__ */ new Set();
  state.flat = [...state.groups.values()].flatMap((group) => group.jobs).filter((job) => !seen.has(job.id) && !!seen.add(job.id) && !deadlinePassed(job.dueAt));
}
async function load() {
  try {
    const data = JSON.parse(await readFile(indexFile(), "utf8"));
    if (data?.version !== VERSION || !Array.isArray(data.groups)) return;
    for (const group of data.groups) if (group?.source?.name && Array.isArray(group.jobs)) state.groups.set(group.source.name, group);
    state.updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : void 0;
    rebuild();
  } catch {
  }
}
async function save() {
  const file = indexFile();
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify({ version: VERSION, updatedAt: state.updatedAt, groups: [...state.groups.values()] }));
  await rename(temp, file);
}
function store(name, jobs) {
  const previous = state.groups.get(name);
  const collectedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (jobs instanceof Error) state.groups.set(name, { source: { name, status: "failed", count: previous?.jobs.length ?? 0, collectedAt: previous?.source.collectedAt ?? collectedAt, message: "\uC218\uC9D1 \uC2E4\uD328 \xB7 \uC774\uC804 \uC218\uC9D1 \uACB0\uACFC \uC720\uC9C0" }, jobs: previous?.jobs ?? [] });
  else state.groups.set(name, { source: { name, status: "ok", count: jobs.length, collectedAt }, jobs });
  rebuild();
}
async function collectWanted(signal, onPage) {
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString(), jobs = [];
  const tagQuery = new Map(ROLE_RULES.filter((rule) => rule.wantedTag && rule.wantedTag !== 518 && rule.wantedTag !== 521).map((rule) => [rule.wantedTag, rule.query]));
  for (let offset = 0; offset < 5e4; offset += 100) {
    const data = obj(await (await request(`https://www.wanted.co.kr/api/v4/jobs?${new URLSearchParams({ country: "kr", job_sort: "job.latest_order", years: "-1", locations: "all", limit: "100", offset: String(offset) })}`, signal)).json());
    if (!Array.isArray(data.data)) throw new Error("wanted_schema_changed");
    for (const item of arr(data.data)) {
      const job = wantedJob(item, checkedAt);
      if (!job) continue;
      const categories = arr(item.category_tags).flatMap((tag) => tagQuery.get(tag.id) ?? []);
      jobs.push({ ...job, category: [job.category, ...categories].filter(Boolean).join(" ") });
    }
    onPage?.(jobs.length);
    if (data.data.length < 100 || !obj(data.links).next) break;
    await delay(250);
  }
  return jobs;
}
async function collectSaramin(queries, pages, signal, onPage) {
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString(), jobs = /* @__PURE__ */ new Map();
  for (const query of queries) {
    for (let page = 1; page <= pages; page++) {
      const html = await (await request(`https://www.saramin.co.kr/zf_user/search/recruit?${new URLSearchParams({ searchword: query, recruitSort: "reg_dt", recruitPageCount: "100", recruitPage: String(page) })}`, signal, "text/html")).text();
      for (const job of parseSaramin(html, checkedAt)) if (!jobs.has(job.id)) jobs.set(job.id, job);
      onPage?.(jobs.size);
      if ((html.match(/class="item_recruit"/g) || []).length < 100) break;
      await delay(600);
    }
  }
  return [...jobs.values()];
}
async function refreshIndex(log = () => {
}) {
  if (state.running) return state.running;
  state.running = (async () => {
    const signal = AbortSignal.timeout(60 * 6e4);
    const counts = {};
    const report = (name, count) => {
      counts[name] = count;
      state.progress = Object.entries(counts).map(([n, c]) => `${n} ${c.toLocaleString("ko-KR")}\uAC74`).join(" \xB7 ");
    };
    const run = async (name, task) => {
      try {
        const jobs = await task();
        store(name, jobs);
        report(name, jobs.length);
        log(`${name}: ${jobs.length}`);
      } catch (cause) {
        store(name, cause instanceof Error ? cause : new Error(String(cause)));
        log(`${name}: failed (${cause instanceof Error ? cause.message : cause})`);
      }
    };
    const queries = [...new Set(ROLE_RULES.map((rule) => rule.query))];
    await Promise.all([
      run("\uC6D0\uD2F0\uB4DC", () => collectWanted(signal, (count) => report("\uC6D0\uD2F0\uB4DC", count))),
      run("\uC0AC\uB78C\uC778", () => collectSaramin(queries, SARAMIN_PAGES, signal, (count) => report("\uC0AC\uB78C\uC778", count))),
      (async () => {
        for (const [board, company] of GREENHOUSE_BOARDS) await run(`${company} \uCC44\uC6A9`, () => greenhouse(board, company, signal));
        for (const provider of companyProviders(null, signal)) await run(provider.name, provider.run);
      })()
    ]);
    state.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await save();
  })().finally(() => {
    state.running = void 0;
    state.progress = void 0;
  });
  return state.running;
}
async function indexedJobs() {
  await (state.loaded ??= load());
  const age = state.updatedAt ? Date.now() - Date.parse(state.updatedAt) : Infinity;
  if (age > TTL && !state.running && process.env.JOB_INDEX_AUTO === "1") refreshIndex().catch(() => {
  });
  return state.flat;
}
function indexInfo() {
  return { total: state.flat.length, updatedAt: state.updatedAt, collecting: !!state.running, progress: state.progress, sources: [...state.groups.values()].map((group) => group.source) };
}
async function collectKeyword(query, signal) {
  const name = `\uC0AC\uB78C\uC778 \xB7 ${query}`;
  const existing = state.groups.get(name);
  if (existing && Date.now() - Date.parse(existing.source.collectedAt) < TTL) return existing.jobs;
  const jobs = await collectSaramin([query], 5, signal);
  store(name, jobs);
  const custom = [...state.groups.keys()].filter((key) => key.startsWith("\uC0AC\uB78C\uC778 \xB7 "));
  if (custom.length > 30) {
    state.groups.delete(custom[0]);
    rebuild();
  }
  save().catch(() => {
  });
  return jobs;
}
async function enrichJobs(jobs, signal, max = 20) {
  const targets = jobs.filter((job) => job.verification !== "detail" && (job.id.startsWith("wanted-") || job.id.startsWith("saramin-") || job.id.startsWith("greeting-"))).slice(0, max);
  const replaced = /* @__PURE__ */ new Map();
  for (let i = 0; i < targets.length; i += 10) {
    const results = await Promise.allSettled(targets.slice(i, i + 10).map(async (job) => {
      const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (job.id.startsWith("wanted-")) {
        const detail = wantedJob(obj(obj(await (await request(`https://www.wanted.co.kr/api/v4/jobs/${job.id.slice(7)}`, signal)).json()).job), checkedAt);
        return detail ? { ...job, ...detail, category: job.category, postedAt: job.postedAt ?? detail.postedAt, verification: "detail" } : null;
      }
      if (job.id.startsWith("greeting-")) return parseGreetingDetail(await (await request(job.url, signal, "text/html")).text(), job, checkedAt);
      const page = await fetchJobPage(job.url, signal);
      return parseJobPage(page.html, page.url, checkedAt, job);
    }));
    results.forEach((result, index) => {
      if (result.status === "fulfilled") replaced.set(targets[i + index].id, result.value);
    });
  }
  for (const group of state.groups.values()) if (group.jobs.some((job) => replaced.has(job.id))) group.jobs = group.jobs.flatMap((job) => !replaced.has(job.id) ? [job] : replaced.get(job.id) ? [replaced.get(job.id)] : []);
  if (replaced.size) rebuild();
  return jobs.flatMap((job) => !replaced.has(job.id) ? [job] : replaced.get(job.id) ? [replaced.get(job.id)] : []);
}
export {
  collectKeyword,
  collectSaramin,
  collectWanted,
  enrichJobs,
  indexInfo,
  indexedJobs,
  refreshIndex
};
