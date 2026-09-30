import test from "node:test";
import assert from "node:assert/strict";
import { parseGreeting, parseGreetingDetail, parseKakao, parseNaver, parseToss, parseWoowahan, withRegion } from "../careers.js";
const checkedAt = "2026-09-29T00:00:00Z";
const nextPage = (queries) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { dehydratedState: { queries } } } })}<\/script></html>`;
test("region prefix lets city-only locations pass the region filter", () => {
  assert.equal(withRegion("\uD310\uAD50"), "\uACBD\uAE30 \uD310\uAD50");
  assert.equal(withRegion("\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uAC15\uB0A8\uAD6C"), "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uAC15\uB0A8\uAD6C");
  assert.equal(withRegion(""), "\uC6D0\uBB38 \uD655\uC778");
});
test("Toss keeps visible Korean roles, reads years and hides closed or hidden jobs", () => {
  const meta = (extra = []) => [{ name: "Employment_Type", value: "\uC815\uADDC\uC9C1" }, { name: "\uD3EC\uC9C0\uC158\uC758 \uC18C\uC18D \uC790\uD68C\uC0AC\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.", value: "\uD1A0\uC2A4\uBC45\uD06C" }, { name: "Job Description\uC744 \uC791\uC131\uD574 \uC8FC\uC138\uC694.", value: "# \uC790\uACA9\n- React 3\uB144 \uC774\uC0C1 \uACBD\uD5D8" }, ...extra];
  const jobs = parseToss({ success: [
    { id: 1, title: "Frontend Developer", location: { name: "Seoul" }, first_published: "2026-09-01T00:00:00-04:00", metadata: meta() },
    { id: 2, title: "Hidden", location: { name: "Seoul" }, metadata: meta([{ name: '\uCEE4\uB9AC\uC5B4\uD398\uC774\uC9C0 \uBA54\uB274\uC5D0 "\uBBF8\uB178\uCD9C" \uB418\uC5B4\uC57C \uD558\uB294 Job\uC778\uAC00\uC694?', value: true }]) },
    { id: 3, title: "Closed", location: { name: "Seoul" }, metadata: meta([{ name: "\uCEE4\uB9AC\uC5B4\uD398\uC774\uC9C0 \uCC44\uC6A9\uACF5\uACE0 \uD074\uB85C\uC9D5 \uC77C\uC790 (\uC11C\uB958\uC811\uC218 \uB9C8\uAC10\uC77C\uC774 \uC815\uD574\uC9C4 \uACBD\uC6B0)", value: "2020-01-01" }]) },
    { id: 4, title: "Brazil role", location: { name: "Brazil" }, metadata: meta() }
  ] }, checkedAt);
  assert.deepEqual(jobs.map((j) => j.id), ["toss-1"]);
  assert.equal(jobs[0].company, "\uD1A0\uC2A4\uBC45\uD06C");
  assert.equal(jobs[0].minYears, 3);
  assert.equal(jobs[0].location, "\uC11C\uC6B8");
  assert.match(jobs[0].description, /React/);
  assert.throws(() => parseToss({ success: null }, checkedAt), /schema/);
});
test("Kakao uses the real job id, full description and skips closed or private offers", () => {
  const jobs = parseKakao({ jobList: [
    { realId: "P-1", jobOfferTitle: "\uD504\uB860\uD2B8\uC5D4\uB4DC \uAC1C\uBC1C\uC790 (\uACBD\uB825)", qualification: "React \uACBD\uB825 3\uB144 \uC774\uC0C1", workContentDesc: "\uC6F9 \uAC1C\uBC1C<br/>", locationName: "\uD310\uAD50", companyName: "\uCE74\uCE74\uC624", regDate: "2026-09-01T10:00:00", skillSetList: [{ skillSetName: "React" }] },
    { realId: "P-2", jobOfferTitle: "closed", closeFlag: true },
    { realId: "P-3", jobOfferTitle: "private", privateFlag: true }
  ] }, checkedAt);
  assert.deepEqual(jobs.map((j) => j.url), ["https://careers.kakao.com/jobs/P-1"]);
  assert.equal(jobs[0].location, "\uACBD\uAE30 \uD310\uAD50");
  assert.equal(jobs[0].minYears, 3);
  assert.equal(jobs[0].level, "\uACBD\uB825");
  assert.deepEqual(jobs[0].skills, ["React"]);
});
test("Naver maps entry type and keeps exact reception times", () => {
  const jobs = parseNaver({ list: [
    { annoId: 10, annoSubject: "[NAVER] \uC11C\uBE44\uC2A4 \uAE30\uD68D (\uC2E0\uC785)", entTypeCdNm: "\uC2E0\uC785", empTypeCdNm: "\uC815\uADDC", stateCdNm: "\uCC44\uC6A9\uC9C4\uD589\uC911", staYmdTime: "2026.09.01 10:00:00", endYmdTime: "2099.10.06 10:00:00" },
    { annoId: 11, annoSubject: "\uC778\uD134", entTypeCdNm: "\uC2E0\uC785", empTypeCdNm: "\uC778\uD134", stateCdNm: "\uCC44\uC6A9\uC9C4\uD589\uC911", endYmdTime: "2099.10.06 10:00:00" },
    { annoId: 12, annoSubject: "\uB9C8\uAC10", entTypeCdNm: "\uACBD\uB825", stateCdNm: "\uCC44\uC6A9\uB9C8\uAC10" }
  ] }, checkedAt);
  assert.deepEqual(jobs.map((j) => [j.id, j.level]), [["naver-10", "\uC2E0\uC785"], ["naver-11", "\uC778\uD134"]]);
  assert.equal(jobs[0].dueAt, "2099-10-06T10:00:00+09:00");
});
test("Woowahan treats unlimited end dates as open and -1 years as any experience", () => {
  const jobs = parseWoowahan({ data: { list: [
    { recruitNumber: "R1", recruitName: "\uBC31\uC5D4\uB4DC \uAC1C\uBC1C", careerRestrictionMinYears: 5, careerRestrictionMaxYears: 10, isUnlimitedEndDate: true, recruitEndDate: "9999-12-31 00:00:00", recruitOpenDate: "2026-09-01 10:00:00" },
    { recruitNumber: "R2", recruitName: "\uBC30\uBBFC \uC601\uC5C5(\uC2E0\uADDC\uC5C5\uC8FC/\uC804\uAD6D)", careerRestrictionMinYears: -1, isUnlimitedEndDate: true },
    { recruitNumber: "R3", recruitName: "\uC885\uB8CC", isAfterOrEqualEndDay: true }
  ] } }, checkedAt);
  assert.deepEqual(jobs.map((j) => [j.id, j.experience, j.dueAt]), [["woowahan-R1", "\uACBD\uB825 5~10\uB144", void 0], ["woowahan-R2", "\uACBD\uB825 \uBB34\uAD00", void 0]]);
  assert.equal(jobs[0].url, "https://career.woowahan.com/recruitment/R1/detail");
});
test("GreetingHR reads openings from page data and detail pages add the description", () => {
  const opening = (id, careerType, employmentType = "FULL_TIME_WORKER", extra = {}) => ({ openingId: id, title: `\uD3EC\uC9C0\uC158 ${id}`, deploy: true, openDate: "2026-09-01T00:00:00Z", openingJobPosition: { openingJobPositions: [{ workspaceOccupation: { occupation: "Frontend" }, workspacePlace: { place: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uAC15\uB0A8\uAD6C" }, jobPositionCareer: { careerType, careerFrom: careerType === "EXPERIENCED" ? 3 : null }, jobPositionEmployment: { employmentType } }] }, ...extra });
  const html = nextPage([{ queryKey: ["openings"], state: { data: [opening(1, "NEW_COMER"), opening(2, "EXPERIENCED"), opening(3, "NOT_MATTER", "INTERN_WORKER"), opening(4, "NEW_COMER", "FULL_TIME_WORKER", { dueDate: "2020-01-01T00:00:00Z" })] } }]);
  const jobs = parseGreeting(html, "kurly.career.greetinghr.com", "\uCEEC\uB9AC", checkedAt);
  assert.deepEqual(jobs.map((j) => [j.id.split("-").pop(), j.level, j.minYears]), [["1", "\uC2E0\uC785", 0], ["2", "\uACBD\uB825", 3], ["3", "\uC778\uD134", 0]]);
  assert.equal(jobs[0].url, "https://kurly.career.greetinghr.com/ko/o/1");
  assert.throws(() => parseGreeting("<html></html>", "x", "x", checkedAt), /schema/);
  const detail = (status) => nextPage([{ queryKey: ["career", "getOpeningById", {}], state: { data: { data: { openingsInfo: { openingId: 1, status, detail: "<p>React \uD544\uC218</p><p>\uC81C\uCD9C\uC11C\uB958: \uC774\uB825\uC11C, \uD3EC\uD2B8\uD3F4\uB9AC\uC624</p>" } } } } }]);
  const full = parseGreetingDetail(detail("OPEN"), jobs[0], checkedAt);
  assert.equal(full.verification, "detail");
  assert.match(full.description, /포트폴리오/);
  assert.equal(parseGreetingDetail(detail("CLOSED"), jobs[0], checkedAt), null);
});
