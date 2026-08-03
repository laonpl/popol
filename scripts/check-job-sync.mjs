/**
 * 직군 · 경력단계 정의 동기화 검사.
 *
 * 배경: 직군 하나를 추가하려면 5곳을 고쳐야 하고, 한 곳만 빠뜨리면
 * "전 직군이 common으로 보이는" 버그가 조용히 생긴다(실제로 있었던 버그).
 * 프론트를 백엔드 API로 파생시키는 방식은 정적 목록을 네트워크 의존으로 바꾸므로,
 * 대신 어긋남을 즉시 실패로 만든다.
 *
 * 소스를 import 하지 않고 텍스트로 파싱한다 — react/axios 의존성 없이 CI에서 바로 돌기 위함.
 *
 * 사용: node scripts/check-job-sync.mjs   (어긋나면 exit 1)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** `export const NAME = { ... }` 블록에서 최상위 키(2칸 들여쓰기) 추출 */
function topLevelKeys(source, name) {
  const start = source.indexOf(name);
  if (start === -1) return [];
  const body = source.slice(start);
  const keys = [];
  for (const line of body.split('\n').slice(1)) {
    if (/^};?\s*$/.test(line)) break;
    const m = line.match(/^ {2}(?:\/\/.*)?([a-zA-Z_][\w]*)\s*:/);
    if (m) keys.push(m[1]);
  }
  return [...new Set(keys)];
}

/** `value: 'x'` 목록 추출 */
const values = (source, name) => {
  const start = source.indexOf(name);
  if (start === -1) return [];
  const end = source.indexOf('\n];', start);
  const body = source.slice(start, end === -1 ? undefined : end);
  return [...new Set([...body.matchAll(/value:\s*'([\w]+)'/g)].map(m => m[1]))];
};

const careerFields = read('backend/src/prompts/careerFieldProfiles.js');
const prompts = read('backend/src/prompts/experiencePrompts.js');
const store = read('frontend/src/stores/experienceStore.js');
const coreSections = read('frontend/src/utils/coreExperienceSections.js');
const devPortfolio = read('frontend/src/utils/devPortfolio.js');
const stagesFile = read('frontend/src/constants/careerStages.js');

const profiles = topLevelKeys(careerFields, 'CAREER_FIELD_PROFILES = {');
const jobCategories = values(store, 'JOB_CATEGORIES = [');
const jobSpecific = topLevelKeys(store, 'JOB_SPECIFIC_FIELDS = {');
const jobSignature = topLevelKeys(coreSections, 'JOB_SIGNATURE = {');
const portfolioMeta = topLevelKeys(devPortfolio, 'JOB_PORTFOLIO_META = {');
const stages = values(stagesFile, 'CAREER_STAGES = [');
const stageRules = topLevelKeys(prompts, 'CAREER_STAGE_RULES = {');

const problems = [];
const warnings = [];
const missing = (from, into) => from.filter(k => !into.includes(k));

// ── 하드 실패: 없으면 기능이 조용히 common 으로 떨어지는 것들 ──
missing(jobCategories, profiles).forEach(k =>
  problems.push(`JOB_CATEGORIES의 '${k}' 가 백엔드 CAREER_FIELD_PROFILES 에 없음 → 이 직군은 common 렌즈로 분석됨`));
missing(jobCategories, jobSpecific).forEach(k =>
  problems.push(`JOB_CATEGORIES의 '${k}' 가 JOB_SPECIFIC_FIELDS 에 없음 → 직군 전용 편집 섹션이 안 보임`));
missing(stages, stageRules).forEach(k =>
  problems.push(`CAREER_STAGES의 '${k}' 가 백엔드 CAREER_STAGE_RULES 에 없음 → 문체 규칙이 first 로 떨어짐`));
missing(jobSignature, profiles).forEach(k =>
  problems.push(`JOB_SIGNATURE의 '${k}' 가 CAREER_FIELD_PROFILES 에 없음 → 존재하지 않는 직군의 산출물 섹션`));

// ── 경고: 폴백이 있어 동작하지만 개성이 사라지는 것들 ──
missing(profiles, jobCategories).forEach(k =>
  warnings.push(`CAREER_FIELD_PROFILES의 '${k}' 를 프론트에서 선택할 수 없음 (JOB_CATEGORIES 미노출)`));
missing(jobCategories, portfolioMeta).forEach(k =>
  warnings.push(`'${k}' 에 JOB_PORTFOLIO_META 가 없어 공통 시각화 구성으로 렌더됨`));

const fmt = (label, list) => `${label}: ${list.length}개 [${list.join(', ')}]`;
console.log(fmt('백엔드 직군 프로필', profiles));
console.log(fmt('프론트 선택 직군', jobCategories));
console.log(fmt('직군 전용 섹션', jobSpecific));
console.log(fmt('시그니처 산출물', jobSignature));
console.log(fmt('시각화 메타', portfolioMeta));
console.log(fmt('경력 단계', stages), '/', fmt('문체 규칙', stageRules));

if (warnings.length) {
  console.log(`\n경고 ${warnings.length}건`);
  warnings.forEach(w => console.log(`  - ${w}`));
}
if (problems.length) {
  console.error(`\n동기화 오류 ${problems.length}건`);
  problems.forEach(p => console.error(`  x ${p}`));
  process.exit(1);
}
console.log('\n동기화 문제 없음');
