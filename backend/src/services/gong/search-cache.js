// Adapted from https://github.com/choi0806/gong (main); TypeScript removed for the FitPoly Node server.
import { rankJobs, ROLE_RULES } from "./matching.js";
import { searchLiveJobs } from "./providers.js";
import { collectKeyword, enrichJobs, indexedJobs, indexInfo } from "./job-index.js";
const state = globalThis;
const { cache, pending } = state.gongchatSearch ??= { cache: /* @__PURE__ */ new Map(), pending: /* @__PURE__ */ new Map() };
const RESULT_LIMIT = 200;
async function liveSearch(profile, skip) {
  const key = JSON.stringify([profile.role, [...profile.skills].sort(), profile.level, profile.location, profile.years, profile.sort, [...skip].sort()]);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return { ...hit.result, cached: true };
  const active = pending.get(key);
  if (active) return { ...await active, cached: true };
  const task = searchLiveJobs({ ...profile, recentDays: 0 }, skip);
  pending.set(key, task);
  try {
    const result = await task;
    if (result.sources.some((source) => source.status === "ok")) {
      if (cache.size >= 50) cache.delete(cache.keys().next().value);
      cache.set(key, { expires: Date.now() + 6e4, result });
    }
    return { ...result, cached: false };
  } finally {
    pending.delete(key);
  }
}
async function searchJobs(profile) {
  const signal = AbortSignal.timeout(5e4);
  const custom = !ROLE_RULES.some((rule) => rule.name === profile.role);
  const index = await indexedJobs();
  const skip = new Set(indexInfo().sources.filter((source) => source.status === "ok" && source.count > 0 && source.name !== "\uC6D0\uD2F0\uB4DC" && source.name !== "\uC0AC\uB78C\uC778").map((source) => source.name));
  const [live, extra] = await Promise.all([
    liveSearch(profile, skip),
    custom ? collectKeyword(profile.role, signal).catch(() => []) : Promise.resolve([])
  ]);
  const all = rankJobs(profile, [...live.jobs, ...extra, ...index], Date.now(), Infinity);
  let jobs = all.slice(0, RESULT_LIMIT);
  if (jobs.length) jobs = rankJobs(profile, await enrichJobs(jobs, signal).catch(() => jobs), Date.now(), RESULT_LIMIT);
  const matched = all.length - (Math.min(all.length, RESULT_LIMIT) - jobs.length);
  const info = indexInfo();
  const coverage = info.total ? `\uC804\uCCB4 \uC218\uC9D1 \uACF5\uACE0 ${info.total.toLocaleString("ko-KR")}\uAC74\uACFC \uC2E4\uC2DC\uAC04 \uAC80\uC0C9\uC5D0\uC11C \uC870\uAC74\uC5D0 \uB9DE\uB294 \uACF5\uACE0 ${matched.toLocaleString("ko-KR")}\uAC74\uC744 \uCC3E\uC558\uC5B4\uC694${matched > RESULT_LIMIT ? ` (\uAD00\uB828\uB3C4 \uC0C1\uC704 ${RESULT_LIMIT}\uAC74 \uD45C\uC2DC)` : ""}.` : info.collecting ? `\uC804\uCCB4 \uACF5\uACE0\uB97C \uCC98\uC74C \uC218\uC9D1\uD558\uB294 \uC911\uC774\uC5D0\uC694${info.progress ? ` (${info.progress})` : ""}. \uC9C0\uAE08\uC740 \uC2E4\uC2DC\uAC04 \uAC80\uC0C9 \uACB0\uACFC\uB9CC \uBCF4\uC5EC\uB4DC\uB824\uC694. \uBA87 \uBD84 \uB4A4 \uB2E4\uC2DC \uCC3E\uC73C\uBA74 \uC804\uCCB4\uC5D0\uC11C \uCC3E\uC544\uB4DC\uB824\uC694.` : "";
  const indexed = new Set(info.sources.filter((source) => source.status === "ok" && source.count > 0).map((source) => source.name));
  const failed = live.sources.filter((source) => source.status === "failed" && !indexed.has(source.name)).map((source) => source.name);
  const message = !jobs.length && (live.jobs.length || index.length) ? "\uC120\uD0DD\uD55C \uACBD\uB825\xB7\uB4F1\uB85D \uAE30\uAC04\xB7\uC9C0\uC5ED\uC5D0 \uB9DE\uB294 \uACF5\uACE0\uAC00 \uC5C6\uC5B4\uC694. \uB4F1\uB85D\uC77C \uBBF8\uD655\uC778 \uACF5\uACE0\uB294 \uCD5C\uADFC \uAE30\uAC04 \uAC80\uC0C9\uC5D0\uC11C \uC81C\uC678\uD574\uC694." : !info.total ? live.message : `${failed.length ? `${failed.slice(0, 3).join(", ")}${failed.length > 3 ? ` \uB4F1 ${failed.length}\uAC1C \uCC44\uB110` : ""}\uC740 \uC9C0\uAE08 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. ` : ""}\uACF5\uAC1C \uCC44\uC6A9 \uBAA9\uB85D \uAE30\uC900\uC774\uBA70, \uBE44\uACF5\uAC1C\xB7\uD5E4\uB4DC\uD5CC\uD305 \uACF5\uACE0\uC640 \uC218\uC9D1 \uC774\uD6C4 \uC62C\uB77C\uC628 \uACF5\uACE0 \uC77C\uBD80\uB294 \uBE60\uC9C8 \uC218 \uC788\uC5B4\uC694.`;
  return { ...live, jobs: jobs.map((job) => job.description.length > 6e3 ? { ...job, description: job.description.slice(0, 6e3) } : job), matched, index: info, message: [coverage, message].filter(Boolean).join(" ") };
}
export {
  searchJobs
};
