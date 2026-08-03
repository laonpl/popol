/**
 * 직군별 평가 축 · 주요 산출물 정리표 생성기.
 *
 * 배경: 직군 정의(평가 축, 산출물, 지표, 주의사항)는 careerFieldProfiles.js 하나에만 있다.
 * 이걸 손으로 문서에 옮겨 적으면 코드가 바뀔 때마다 문서가 조용히 낡는다.
 * 그래서 문서를 코드에서 생성한다 — 표와 코드가 어긋나면 항상 코드가 정답이다.
 *
 * 사용: node scripts/gen-career-field-table.mjs
 * 출력: docs/직군별_평가축_산출물_정리표.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_SRC = path.join(ROOT, 'backend/src/prompts/careerFieldProfiles.js');
const OUT = path.join(ROOT, 'docs/직군별_평가축_산출물_정리표.md');

const { CAREER_FIELD_PROFILES } = await import(pathToFileURL(PROFILE_SRC).href);
const { SLOTS, TYPES, ITEM_EVIDENCE, ARTIFACT_STATES, ARTIFACT_MAP } =
  await import(pathToFileURL(path.join(ROOT, 'scripts/career-field-item-evidence.mjs')).href);

/* 프론트 JOB_CATEGORIES의 그룹 구분과 맞춘다 (experienceStore.js) */
const GROUPS = [
  ['기술·엔지니어링', ['dev', 'aiml', 'da', 'devops', 'security', 'qa', 'engineering']],
  ['기획·디자인·콘텐츠', ['pm', 'project', 'designer', 'marketer', 'content']],
  ['비즈니스·운영', ['hr', 'sales', 'customer_success', 'finance', 'strategy', 'operations']],
  ['연구·공공·전문', ['research', 'education', 'policy', 'legal', 'healthcare']],
];

/* ── 직군별 근거 ──
   출처: docs/career-field-evidence-research-2026.md (2026-07-27 조사)
   그 문서는 근거를 "소프트웨어와 AI", "QA와 보안" 같은 묶음 단위로 적어 두었다.
   여기서는 직군 키 단위로 재배열해 표에 바로 붙인다.

   basis   : 어떤 공식 기준을 참고했는가
   took    : 그 기준에서 우리가 실제로 가져온 것 (= 평가 축이 이렇게 정해진 이유)
   sources : 원문 링크
   tier    : 'standard' = 분야 공식 기준 있음 / 'common' = 공통 모델만 적용 (근거 약함) */
const EVIDENCE = {
  common: {
    basis: 'O*NET Content Model · NACE Career Readiness Competencies',
    took: '직업을 과업·활동·역량·맥락으로 나눠 서로 다른 직무를 같은 구조로 비교하는 방식(O*NET)과, 직무를 가로지르는 8개 준비 역량(NACE)을 공통 층으로 삼았다. 그래서 등록되지 않은 직무도 "판단·기여·검증·변화" 렌즈로 처리할 수 있다.',
    sources: [
      ['O*NET Content Model', 'https://www.onetcenter.org/content.html'],
      ['NACE Career Readiness Competencies', 'https://www.naceweb.org/career-readiness/competencies/career-readiness-defined'],
    ],
    tier: 'standard',
  },
  dev: {
    basis: 'DORA (DevOps Research and Assessment)',
    took: 'DORA가 소프트웨어 전달을 변경 리드타임·배포 빈도·실패 배포 복구 시간·변경 실패율·재작업률로 함께 본다는 점에서, 개인 성과를 "코드 양"이 아니라 **전달과 복구의 결과**로 평가하는 축을 가져왔다.',
    sources: [
      ['DORA Guides', 'https://dora.dev/guides/'],
      ['DORA Metrics History', 'https://dora.dev/insights/dora-metrics-history/'],
    ],
    tier: 'standard',
  },
  aiml: {
    basis: 'Google Production ML (프로덕션 ML 가이드)',
    took: '학습·검증·테스트 분리, 데이터/특징 드리프트, 훈련-서빙 차이, 코드·모델·데이터 버전, 지연·처리량·비용, 배포와 롤백을 함께 관리한다는 원칙에서 "점수 하나로 판단하지 않는다"는 평가 축이 나왔다.',
    sources: [
      ['Google Production ML Monitoring', 'https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring'],
      ['Managing ML Projects: Production', 'https://developers.google.com/machine-learning/managing-ml-projects/production'],
    ],
    tier: 'standard',
  },
  da: {
    basis: 'Tableau Story Best Practices',
    took: '분석 스토리에서 목적과 청중, 근거에서 결론으로 이어지는 순서, 주석·필터 가능한 뷰를 강조한다는 점에서 "차트가 아니라 질문·지표 정의·실제 의사결정 연결"을 평가 축으로 삼았다.',
    sources: [['Tableau Story Best Practices', 'https://help.tableau.com/current/pro/desktop/en-us/story_best_practices.htm']],
    tier: 'standard',
  },
  devops: {
    basis: 'DORA (플랫폼 엔지니어링 포함)',
    took: '개발 직군과 같은 DORA 지표군을 쓰되, 인시던트 관점(탐지→영향→원인→복구/영구안→롤백)으로 단위를 잡았다.',
    sources: [
      ['DORA Guides', 'https://dora.dev/guides/'],
      ['DORA Platform Engineering', 'https://dora.dev/capabilities/platform-engineering/'],
    ],
    tier: 'standard',
  },
  security: {
    basis: 'OWASP ASVS (Application Security Verification Standard)',
    took: 'ASVS가 보안을 "도구를 썼는가"가 아니라 **적절한 보증 수준의 요구사항과 실제 검증 증거**로 다룬다는 점에서, 스캐너 실행 기록이 아니라 재현·수정 검증·잔여 위험을 평가 축으로 삼았다.',
    sources: [['OWASP ASVS Guide', 'https://devguide.owasp.org/en/06-verification/01-guides/03-asvs/']],
    tier: 'standard',
  },
  qa: {
    basis: 'ISTQB CTFL Syllabus v4.0.1',
    took: '테스트 목적과 근거, 계획·분석·설계·구현·실행·모니터링·종료 단계, 테스트 산출물과 **추적성**을 구분한다는 점에서 "케이스 개수"가 아니라 요구사항-테스트-결함 추적과 종료 기준을 평가 축으로 삼았다.',
    sources: [['ISTQB CTFL Syllabus v4.0.1', 'https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf']],
    tier: 'standard',
  },
  engineering: {
    basis: 'INCOSE SECF / SECAG (Systems Engineering Competency Framework · Assessment Guide)',
    took: 'INCOSE가 37개 시스템 엔지니어링 역량을 **지식·기술·능력·행동(KSAB) 지표와 5단계 숙련도, 그리고 각 지표에 대한 증거 예시**로 평가한다는 점이 근거다. "무엇을 만들었다"가 아니라 요구사항 추적·검증 성공 기준·결과 기록이 요구사항으로 되돌아오는 추적성을 평가 축으로 삼았다.',
    sources: [
      ['INCOSE Competency Framework', 'https://www.incose.org/resources-publications/publish-with-incose/competency-framework/'],
      ['SE Competencies Framework (PDF)', 'https://ifse.org.uk/Documents/Groups/UKChapter/SE_Competencies_Framework_Issue_3.pdf'],
    ],
    tier: 'standard',
  },
  pm: {
    basis: 'Atlassian Product Requirements (PRD 구조)',
    took: 'PRD가 목적·고객 요구·목표·가정·사용자 스토리·디자인·**범위 밖 항목**·성공 지표·역할·릴리스 상태를 포함한다는 구조에서, "무엇을 안 하기로 했는가"와 성공/반증 기준을 평가 축에 넣었다.',
    sources: [['Atlassian Product Requirements', 'https://www.atlassian.com/agile/product-management/requirements']],
    tier: 'standard',
  },
  project: {
    basis: 'PMI PMCDF · Talent Triangle',
    took: 'PMI가 프로젝트 역량을 지식·실제 수행·개인 행동의 세 차원과 **성과 기준 및 증거**로 평가한다는 점에서, 계획 문서 보유가 아니라 베이스라인 대비 편차·변경 통제·인수를 평가 축으로 삼았다.',
    sources: [
      ['PMI Competency Development Framework', 'https://www.pmi.org/standards/pm-competency-development-third-edition'],
      ['PMI Talent Triangle', 'https://www.pmi.org/certifications/certification-resources/maintain/talent-triangle'],
    ],
    tier: 'standard',
  },
  designer: {
    basis: 'Nielsen Norman Group UX Careers Report',
    took: 'NN/g 조사에서 **채용 담당자가 포트폴리오의 작업 흐름·사고 과정과 지원자가 직접 한 일을 중시**한다고 나온 점이 근거다. 그래서 완성 시안이 아니라 리서치 원문·시안 비교·반복 전후를 평가 축으로 삼았다.',
    sources: [['NN/g UX Careers Report', 'https://media.nngroup.com/media/reports/free/UserExperienceCareers_2nd_Edition.pdf']],
    tier: 'standard',
  },
  marketer: {
    basis: 'Google Ads Attribution',
    took: 'Google Ads가 **의미 있는 전환 행동, 고객 경로, 귀인 모델을 분리**한다는 점에서, 단일 숫자 자랑이 아니라 전환 정의·경로·귀인 한계를 평가 축에 명시했다.',
    sources: [
      ['Google Ads Attribution Models', 'https://support.google.com/google-ads/answer/6259715'],
      ['Google Ads Attribution Reports', 'https://support.google.com/google-ads/answer/1722023'],
    ],
    tier: 'standard',
  },
  content: {
    basis: 'SPJ Code of Ethics (Society of Professional Journalists)',
    took: 'SPJ가 **배포 전 검증과 원자료 우선, 출처의 신뢰도·동기를 판단할 수 있게 하는 명시, 오류의 신속·명확한 정정과 그 이유 설명**을 요구한다는 점이 근거다. 그래서 완성 발행물이 아니라 자료 조사·편집 판단·**수정 이력**을 평가 축으로 삼았다.',
    sources: [
      ['SPJ Code of Ethics', 'https://www.spj.org/spj-code-of-ethics/'],
      ['SPJ Ethics Code (PDF)', 'https://www.spj.org/pdf/ethicscode.pdf'],
    ],
    tier: 'standard',
  },
  hr: {
    basis: 'SHRM BASK (Body of Applied Skills and Knowledge)',
    took: 'SHRM이 HR 전문 지식과 함께 **윤리·관계 관리·커뮤니케이션·비즈니스 이해·자문·비판적 평가**를 요구한다는 점에서, 제도 도입 여부가 아니라 진단·공정성/법규·수용성과 부작용까지 평가 축에 넣었다.',
    sources: [['SHRM BASK', 'https://www.shrm.org/credentials/certification/exam-preparation/bask']],
    tier: 'standard',
  },
  sales: {
    basis: 'Salesforce Sales Process',
    took: '조사→잠재 고객 발굴→세일즈 콜·클로징→관계 형성으로 이어지는 과정을 근거로, 계약 금액 하나가 아니라 자격 판단·구매 기준·**실주 이유**까지 단위에 포함했다.',
    sources: [['Salesforce Sales Process', 'https://trailhead.salesforce.com/content/learn/modules/build-a-sales-process/learn-about-the-sales-process']],
    tier: 'standard',
  },
  customer_success: {
    basis: 'Customer Success Association — CSM Competency Standard',
    took: 'CSA 표준이 **고객 헬스 스코어를 어떻게 생성·평가·관리하는가**를 핵심 역량으로 다루고, 채택 단계 종료 기준(사용 임계값 도달·핵심 교육 완료·내부 챔피언 확보)을 정의한다는 점이 근거다. 그래서 문의 처리량이 아니라 고객 목표·반복 원인·채택과 갱신을 평가 축으로 삼았다.',
    sources: [['CSM Competency Standard', 'https://www.customersuccessassociation.com/library/the-csm-competency-standard-basic-level/']],
    tier: 'standard',
  },
  finance: {
    basis: 'IMA 관리회계 역량 · CFA Standards of Practice',
    took: 'IMA가 전략·계획·성과, 보고·통제, 기술·분석, 위험·거버넌스, 윤리를 함께 다루고, **CFA가 "결과가 나빴다는 사실만으로 역량 부족을 단정하지 않는다"**고 규정한 점이 핵심 근거다. 그래서 수익률이 아니라 가정·시나리오·검산·윤리를 평가 축으로 삼았다.',
    sources: [
      ['IMA Management Accounting Competencies', 'https://prod.imanet.org/career-resources/management-accounting-competencies/'],
      ['CFA Competence Standard', 'https://www.cfainstitute.org/standards/professionals/code-ethics-standards/standards-of-practice-i-e'],
    ],
    tier: 'standard',
  },
  strategy: {
    basis: 'ICMCI CMC Competence Framework · ISO 20700:2017',
    took: 'CMC 프레임워크가 역량을 **비즈니스·기술·가치와 행동** 3개 축 8개 역량으로 묶고, "**독립적으로, 감독 없이 과제를 완수**했음을 실무에서 입증"할 것을 요구한다는 점이 근거다. 그래서 프레임워크 이름이 아니라 핵심 질문·가설 우선순위·권고의 실행 조건을 평가 축으로 삼았다.',
    sources: [
      ['ICMCI CMC Competence Framework (PDF)', 'https://www.cmc-global.org/sites/default/files/public/icmci_competence_framework_overview_version_4.2.pdf'],
      ['CMC | ICMCI', 'https://www.cmc-global.org/content/cmc'],
    ],
    tier: 'standard',
  },
  operations: {
    basis: 'ASQ DMAIC · ASCM SCOR',
    took: 'DMAIC가 문제와 VOC, **기준선**, 근본 원인, 대안 시험, 표준화와 반응 계획을 연결하고, SCOR가 프로세스·성과·관행·사람을 함께 본다는 점에서 "개선했다"가 아니라 기준선 대비 변화와 통제 유지를 평가 축으로 삼았다.',
    sources: [
      ['ASQ DMAIC', 'https://asq.org/quality-resources/dmaic'],
      ['ASCM SCOR Digital Standard', 'https://www.ascm.org/globalassets/ascm_website_assets/docs/intro-and-front-matter-scor-digital-standard2.pdf'],
    ],
    tier: 'standard',
  },
  research: {
    basis: 'NISO CRediT (Contributor Roles Taxonomy)',
    took: 'CRediT이 연구 기여를 **14개 표준 역할로 분리**한다는 점이 근거다. 공저자라는 사실이 아니라 어떤 역할을 했는지를 평가 축으로 삼았고, 부정 결과와 재현도 증거에 포함했다.',
    sources: [['NISO CRediT Standard', 'https://www.niso.org/publications/z39104-2022-credit']],
    tier: 'standard',
  },
  education: {
    basis: 'ISTE Standards for Educators',
    took: '학습자·리더·시민·협력자·설계자·촉진자·**분석가** 역할과 데이터 기반 대안 평가를 강조한다는 점에서, 수업안 보유가 아니라 목표-활동-평가 정렬과 사전-사후 변화를 평가 축으로 삼았다.',
    sources: [['ISTE Standards for Educators', 'https://iste.org/standards/educators']],
    tier: 'standard',
  },
  policy: {
    basis: 'OECD Public Policy Monitoring and Evaluation',
    took: 'OECD가 목표·가정·위험을 투입-산출-성과-영향으로 연결하고 **모니터링과 인과 평가를 구분**한다는 점에서, "시행했다"와 "효과가 있었다"를 분리해 평가 축에 넣었다.',
    sources: [
      ['OECD Policy Monitoring and Evaluation', 'https://www.oecd.org/en/topics/public-policy-monitoring-and-evaluation.html'],
      ['OECD Results Framework', 'https://www.oecd.org/en/publications/monitoring-and-evaluation-of-child-and-youth-policies-and-outcomes-in-ireland_2bd86a9d-en/full-report/component-5.html'],
    ],
    tier: 'standard',
  },
  legal: {
    basis: 'ISO 37301:2021 (컴플라이언스 경영시스템) · DOJ Evaluation of Corporate Compliance Programs',
    took: 'ISO 37301이 컴플라이언스를 **위험 기반 접근**과 좋은 거버넌스·비례성·성실성·투명성·**책무성**의 원칙 위에서 수립·평가·개선하는 체계로 규정하고, DOJ가 프로그램의 **적정성과 실효성**을 판단 기준으로 삼는다는 점이 근거다. 그래서 "문제가 없었다"가 아니라 위험 기반 대안·승인·시정 추적을 평가 축으로 삼았다.',
    sources: [
      ['ISO 37301:2021', 'https://www.iso.org/standard/75080.html'],
      ['Compliance Risk and ISO 37301 (PDF)', 'https://ihmm.org/wp-content/uploads/2023/04/US_Landing_Pages_-_Compliance_Risk_and_ISO_37301_Whitepaper_2022.pdf'],
    ],
    tier: 'standard',
  },
  healthcare: {
    basis: 'WHO Quality of Care',
    took: 'WHO가 의료 품질을 안전성·효과성·사람 중심성·적시성·형평성·통합성·효율성으로 보고 **지표 데이터 품질과 의도치 않은 결과를 함께 확인**한다는 점에서, 개선 수치만이 아니라 부작용과 역할 범위를 평가 축에 넣었다.',
    sources: [
      ['WHO Quality of Care', 'https://www.who.int/health-topics/quality-of-care'],
      ['WHO Quality Measurement Guide', 'https://www.who.int/publications/i/item/9789240105737'],
    ],
    tier: 'standard',
  },
};

const j = (a) => (a || []).join(' · ');
const profiles = CAREER_FIELD_PROFILES;

/* 근거가 등록되지 않은 직군을 즉시 알린다 */
const noEvidence = Object.keys(profiles).filter(k => !EVIDENCE[k]);
if (noEvidence.length) {
  console.error(`[경고] EVIDENCE에 근거가 없는 직군: ${noEvidence.join(', ')}`);
  process.exit(1);
}

const srcLinks = (list) => (list || []).length
  ? list.map(([t, u]) => `[${t}](${u})`).join(' · ')
  : '—';

/* 그룹에서 빠진 직군이 있으면 즉시 알린다 — 직군을 추가하고 여기 등록을 잊는 실수 방지 */
const grouped = new Set(GROUPS.flatMap(([, keys]) => keys));
const missing = Object.keys(profiles).filter(k => k !== 'common' && !grouped.has(k));
if (missing.length) {
  console.error(`[경고] GROUPS에 등록되지 않은 직군: ${missing.join(', ')}`);
  console.error('       scripts/gen-career-field-table.mjs 의 GROUPS 에 추가해주세요.');
  process.exit(1);
}

const total = Object.keys(profiles).length;

let md = `# 직군별 평가 축 · 주요 산출물 정리표

작성일: ${new Date().toISOString().slice(0, 10)}
출처: \`backend/src/prompts/careerFieldProfiles.js\` (코드에서 자동 생성 — 손으로 고치지 말 것)
대상 직군: **${total}개** (공통 1 + 직군 ${total - 1})

---

## 이 표를 읽는 법

FitPoly는 직군마다 **"무엇을 경험으로 인정할 것인가"**를 다르게 정의한다. 같은 프로젝트라도 개발자는 *기술 의사결정*으로, PM은 *제품 의사결정*으로, 디자이너는 *리서치 기반 개선 반복*으로 쪼개야 심사자가 읽을 수 있는 단위가 된다.

| 열 | 뜻 | 쓰임 |
|---|---|---|
| **정리 단위** | 이 직군에서 경험을 쪼개는 최소 단위 | 경험 1건 = 이 단위 1개 |
| **핵심 역량 (평가 축)** | 심사자가 실제로 확인하는 신호 | 이게 없으면 "일한 기록"에 그친다 |
| **주요 산출물** | 근거로 첨부할 수 있는 실물 | 증거 자료 연결 시 이 목록에서 찾는다 |
| **성과 지표** | 이 직군에서 통하는 수치 | 아무 숫자나 넣지 않기 위한 기준 |
| **주의 (오독 방지)** | 흔히 착각하는 것 | 과장·오해를 막는 가드레일 |

> ⚠️ **"주요 산출물"은 자랑거리 목록이 아니라 증거 목록이다.**
> 개발 직군의 \`Git 저장소\`는 "깃허브가 있다"는 뜻이 아니라 **주장한 기여를 확인할 수 있는 자료**라는 뜻이다. 그래서 각 직군의 "주의" 항목에 *"파일 보유를 작성자·의사결정자 증거로 간주하지 않기"* 같은 경고가 붙는다.

### 4개 포트폴리오 슬롯과의 관계

제품은 포트폴리오를 4칸으로 본다 ([\`experienceReadiness.js\`](../frontend/src/utils/experienceReadiness.js)).

| 슬롯 | 이 표에서 대응하는 것 |
|---|---|
| **대표 성과** \`flagship\` | 성과 지표 열에서 가장 강한 수치를 가진 경험 |
| **문제 해결** \`problem_solving\` | 정리 단위 그 자체 (대부분 직군의 단위가 문제 해결형) |
| **협업·조율** \`collaboration\` | 핵심 역량 중 이해관계자·합의·조율 신호 |
| **성장·주도성** \`growth\` | 핵심 역량 중 "판단이 바뀐 것", "남은 부채/다음 실험" |

---

## 1. 한눈에 보기

| 직군 | 정리 단위 | 핵심 역량 (평가 축) | 주요 산출물 |
|---|---|---|---|
`;

const c = profiles.common;
md += `| **전 직군 공통** | ${c.unit} | ${j(c.proofSignals)} | ${j(c.artifacts)} |\n`;
for (const [g, keys] of GROUPS) {
  md += `| **《${g}》** | | | |\n`;
  for (const k of keys) {
    const f = profiles[k];
    md += `| ${f.label} | ${f.unit} | ${j(f.proofSignals)} | ${j(f.artifacts)} |\n`;
  }
}

/* ── 근거 강도 요약 ── */
const allKeys = ['common', ...GROUPS.flatMap(([, ks]) => ks)];
const weak = allKeys.filter(k => EVIDENCE[k].tier === 'common');
md += `
---

## 2. 근거 강도 — 어디까지 검증됐나

각 직군의 평가 축은 임의로 정한 게 아니라 해당 분야의 공식 기준에서 가져왔다. 다만 **모든 직군이 같은 수준으로 뒷받침되지는 않는다.**

| 등급 | 뜻 | 직군 수 |
|---|---|---:|
| 🟢 **분야 공식 기준 있음** | DORA·ISTQB·OWASP·PMI 같은 표준/공인 자료에서 평가 축을 도출 | ${allKeys.length - weak.length} |
| 🟡 **공통 모델만 적용** | O*NET/NACE 공통 층을 해당 맥락으로 옮긴 것. 분야 표준 미반영 | ${weak.length} |

`;
if (weak.length) {
  md += `> ⚠️ **근거가 약한 직군 (${weak.length}개)**: ${weak.map(k => profiles[k].label).join(' · ')}\n>\n`;
  md += '> 이 직군들은 "우리가 이렇게 보는 게 맞다"를 외부 기준으로 증명하지 못한 상태다.\n';
  md += '> 인사담당자 면담이나 사용자 검증에서 **가장 먼저 반박당할 수 있는 지점**이므로, 해당 분야 표준을 찾아 보강하거나 지원 직군에서 내리는 판단이 필요하다.\n\n';
} else {
  md += '> ✅ **전 직군이 분야 공식 기준에 연결되어 있다.**\n>\n';
  md += '> 다만 기준의 성격은 같지 않다. 국제표준(ISO 37301), 전문단체 표준(INCOSE·PMI·SHRM·ISTQB·ICMCI·CSA·SPJ), 국제기구 가이드(WHO·OECD), 업계 연구·벤더 문서(DORA·Google·Atlassian·Tableau·NN/g·Salesforce)가 섞여 있다.\n';
  md += '> **벤더 문서 기반 직군**(개발·AI/ML·데이터·인프라·PM·마케팅·영업)은 중립적 표준이 아니므로, 대외 설명 시 "업계 관행"으로 표현하는 편이 정확하다.\n\n';
}

md += `> 📅 **조사 이력**: 1차 2026-07-27 (19개 직군, [career-field-evidence-research-2026.md](./career-field-evidence-research-2026.md)) · 2차 2026-08-03 (하드웨어·콘텐츠·고객성공·전략·법무 5개 보강)\n\n`;

/* ── 항목이 왜 그 항목인가: 공통 골격 ── */
md += `---

## 3. 왜 하필 이 항목들인가

### 3-1. 핵심 역량이 모든 직군에서 정확히 5개인 이유

24개 직군 전부 핵심 역량이 **5개**다. 우연이 아니라, 공통 추출 모델의 5단계를 각 직군의 언어로 번역했기 때문이다.
(공통 모델은 O*NET Content Model과 NACE 준비 역량에서 도출 — [career-field-evidence-research-2026.md](./career-field-evidence-research-2026.md) 「공통 추출 모델」)

| 슬롯 | 묻는 것 | 전 직군 공통 | 개발 | 기획/PM | 디자인 |
|---|---|---|---|---|---|
| **관찰** | 문제가 실재했음을 무엇으로 보이나 | 문제의 구체성 | 재현 가능한 증상 | 사용자 근거 | 사용자 맥락/발화 |
| **판단** | 그 문제를 어떻게 해석했나 | — | 원인 가설을 버린 근거 | 목표와 범위 밖 항목 | 문제 해석 |
| **대안** | 무엇을 고르고 무엇을 버렸나 | 선택과 포기의 근거 | 기술 선택 trade-off | 대안과 trade-off | 시안 비교 |
| **검증** | 결과를 무엇으로 확인했나 | 결과를 확인한 직접 자료 | 테스트/모니터링 결과 | 성공/반증 기준 | 과업 기반 테스트 |
| **잔여·변화** | 남은 것과 달라진 것 | 이후 달라진 원칙 | 남은 기술 부채 | 출시 후 판단 변화 | 반복 전후·접근성 |

> 💡 **이 구조가 핵심 주장이다.** "개발자는 트러블슈팅, PM은 제품 의사결정"처럼 단위는 달라도, 심사자가 확인하는 것은 항상
> **관찰 → 판단 → 대안 → 검증 → 잔여**다. 직군별 차이는 *이 5칸을 무엇으로 채우는가*뿐이다.

### 3-2. 항목별 근거의 성격

각 항목이 어디서 왔는지는 4단계로 구분해 표기한다. **전부가 표준에서 온 것은 아니다.**

| 표기 | 뜻 | 신뢰 수준 |
|---|---|---|
| ${TYPES.A.mark} **${TYPES.A.label}** | 인용한 표준 문서가 그 개념을 직접 요구 | 높음 — 출처로 방어 가능 |
| ${TYPES.B.mark} **${TYPES.B.label}** | 표준의 원칙을 우리가 이 직군 맥락으로 옮김 | 중간 — 논리는 있으나 해석이 개입 |
| ${TYPES.C.mark} **${TYPES.C.label}** | 분야에서 통용되나 특정 표준에 명시된 것은 아님 | 중간 — "업계에서 그렇게 한다" 수준 |
| ${TYPES.D.mark} **${TYPES.D.label}** | 우리가 정한 것. 외부 근거 없음 | 낮음 — **검증 대상** |

### 3-3. 주요 산출물을 그 목록으로 정한 이유

산출물은 "있으면 좋은 자료"가 아니라 **어떤 사실 상태를 증명하는가**로 골랐다.
연구 문서의 「자료 판독 원칙」은 \`제안 → 승인 → 실행 → 결과 확인 → 장기 효과 확인\`을 **서로 다른 상태**로 본다.

| 상태 | 증명하는 것 | 증명하지 **못**하는 것 |
|---|---|---|
${ARTIFACT_STATES.map(s => `| **${s.key}** | ${s.proves} | ${s.notProves} |`).join('\n')}

> ⚠️ 그래서 PRD는 *계획*의 증거일 뿐 출시·효과의 증거가 아니고, 프로토타입은 *실행*의 증거일 뿐 실제 사용의 증거가 아니다.
> 각 직군 상세의 접이식 블록에서 산출물마다 이 분류를 확인할 수 있다.

---

## 4. 직군별 상세
`;
for (const [g, keys] of GROUPS) {
  md += `\n### 《${g}》\n`;
  for (const k of keys) {
    const f = profiles[k];
    const e = EVIDENCE[k];
    const badge = e.tier === 'standard' ? '🟢' : '🟡';
    md += `\n#### ${badge} ${f.label}\n\n> ${f.emphasis}\n\n`;
    md += '| 구분 | 내용 |\n|---|---|\n';
    md += `| **정리 단위** | ${f.unit} |\n`;
    md += `| **핵심 역량 (평가 축)** | ${j(f.proofSignals)} |\n`;
    md += `| **주요 산출물** | ${j(f.artifacts)} |\n`;
    md += `| **성과 지표** | ${j(f.metrics)} |\n`;
    md += `| **주의 (오독 방지)** | ${j(f.cautions)} |\n`;
    md += `| **근거 기준** | ${e.basis} |\n`;
    md += `| **왜 이 축인가** | ${e.took} |\n`;
    md += `| **출처** | ${srcLinks(e.sources)} |\n`;

    /* ── 항목 단위 근거 ── */
    const items = ITEM_EVIDENCE[k];
    md += `\n<details>\n<summary><b>항목별 근거 — 왜 하필 이 5개인가 / 이 산출물들인가</b></summary>\n\n`;
    md += '| # | 핵심 역량 항목 | 슬롯 | 근거 |\n|:--:|---|---|---|\n';
    f.proofSignals.forEach((sig, i) => {
      const [slot, type, why] = items[i];
      md += `| ${i + 1} | ${sig} | ${SLOTS[slot].label} | ${TYPES[type].mark} ${why} |\n`;
    });

    md += '\n| 주요 산출물 | 증명하는 것 | 증명하지 못하는 것 |\n|---|---|---|\n';
    f.artifacts.forEach((art, i) => {
      const stKey = ARTIFACT_MAP[k][i];
      const st = ARTIFACT_STATES.find(s => s.key === stKey);
      md += `| ${art} | **${stKey}** — ${st.proves} | ${st.notProves} |\n`;
    });
    md += '\n</details>\n';
  }
}

md += `

---

## 5. 활용처

| 용도 | 방법 |
|---|---|
| **경험 정리 안내** | 사용자가 직군을 고르면 해당 행의 "핵심 역량"을 작성 가이드로 노출 |
| **증거 자료 요청** | "주요 산출물"을 체크리스트로 제시 — 무엇을 첨부할지 막막함 해소 |
| **수치 입력 유도** | "성과 지표" 항목만 제안 — 관계없는 숫자를 넣지 않게 |
| **인사담당자 면담** | 직군별로 이 표를 보여주고 *"실제로 이걸 보시나요?"* 검증 |
| **2주 프로그램** | 참가자 직군별 과제 안내문의 근거 자료 |
| **대외 설명** | "왜 이 기준인가"를 물었을 때 출처 링크로 답변 (IR·제휴·면담) |
| **직군 축소 판단** | 🟡 등급 직군은 근거가 약함 — 유지/제거 판단의 1순위 후보 |

## 6. 재생성

이 문서는 자동 생성물이다. 코드가 바뀌면 다시 생성한다.

\`\`\`bash
node scripts/gen-career-field-table.mjs
\`\`\`

> 📌 표와 코드가 어긋나면 **코드가 정답**이다. 이 문서를 손으로 고치지 말고 \`careerFieldProfiles.js\`를 고친 뒤 재생성한다.
> 직군을 새로 추가하면 이 스크립트의 \`GROUPS\`에도 등록해야 한다 (누락 시 스크립트가 실패한다).

---

*관련 문서: [인사담당자 면담 설계](./인사담당자_면담_설계_2026-08-03.md) · [2주 포트폴리오 완주 프로그램 기획서](./2주_포트폴리오_완주_프로그램_기획서.md) · [경험정리 산출물 체계](./경험정리_산출물_체계.md)*
`;

fs.writeFileSync(OUT, md, 'utf8');
console.log(`생성 완료: ${path.relative(ROOT, OUT)} (직군 ${total}개, ${md.split('\n').length}줄)`);
