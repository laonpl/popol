# FitPoly 직군별 경험 구조 설계 근거 — 개발자 · 마케터 · 기획/PM

작성일: 2026-08-02

이 문서는 FitPoly가 세 직군의 경험을 **왜 지금과 같은 형태로 쪼갰는지**를 공개 기준과 함께 정리한 자립 문서다.
구조 명세가 아니라, 각 필드가 존재하는 이유와 그 필드가 막으려는 실패를 다룬다.

---

## 1. 설계 원칙 — 직업명이 아니라 증거의 종류로 나눈다

세부 직업명을 전부 하드코딩하는 방식은 유지될 수 없다. 직무명은 회사마다 다르고 계속 생긴다.
그래서 FitPoly는 **채용에서 유사한 증거를 요구하는 단위**로 묶고 별칭(alias)으로 라우팅한다.
`frontend`, `backend`, `fullstack`, `mobile`, `개발자`는 모두 `dev` 프로필로 들어간다.

경험은 두 층으로 본다.

| 층 | 내용 | 근거 |
|---|---|---|
| **공통 층** | 상황·과업 → 문제 판단 → 대안 → 선택 기준 → 직접 실행 → 결과 근거 → 판단 변화 → 기여 범위 | O\*NET, NACE |
| **직군 층** | 이 분야에서 **무엇을 한 건으로 세는가**, **무엇이 강한 증거인가** | 분야별 공개 기준 (5~7장) |

**O\*NET**은 직업을 과업·상세 업무 활동·요구 역량·업무 맥락으로 나눠 수많은 직무를 같은 구조에서 비교한다.
**NACE**는 직무를 가로지르는 준비 역량을 커뮤니케이션·비판적 사고·팀워크·기술 등 여덟 영역으로 정리한다.
이 둘이 공통 층의 근거다. 등록되지 않은 직무도 공통 렌즈로 판단·기여·검증·변화를 추출할 수 있다.

---

## 2. 공통 판독 기준 — 구조를 나눠도 없는 사실은 만들지 않는다

세 직군 모두에 적용되는 안전장치다.

### 2.1 사실 상태 구분

`제안 → 승인 → 실행 → 결과 확인 → 장기 효과 확인`은 **서로 다른 상태**다.

- PRD는 문제 정의와 계획의 증거가 될 수 있지만 출시와 사용자 효과를 증명하지 않는다.
- 프로토타입은 설계·제작의 증거이지 실제 사용의 증거가 아니다.

### 2.2 근거 수준

| 등급 | 자료 |
|---|---|
| A | 시스템 로그, 원데이터, 실제 배포·발행물, 계약·시험 결과 |
| B | 본인 초안과 버전 이력, 승인 문서, 회의록, 피드백 |
| C | 날짜·작성자·위치가 불완전한 캡처나 정리본 |
| D | 지원자의 회상만 있고 연결된 자료가 없는 주장 |

### 2.3 충돌 처리

- 직접 기록을 회상보다 우선한다.
- 같은 종류라면 최신 버전을 우선하되, **판단 변화는 이전 버전과 함께 보존**한다.
- 숫자가 다르면 기간·분모·대상·버전을 확인하기 전 하나로 합치지 않는다.
- 파일 보유 사실을 작성자나 의사결정자 증거로 간주하지 않는다.

---

## 3. 세 직군을 가르는 핵심 — 경험의 단위가 다르다

같은 프로젝트를 겪어도 직군에 따라 **한 건으로 세는 덩어리**가 다르다. 이것이 구조 분기의 출발점이다.

| 직군 | 경험의 단위 | 한 건이 완결되는 시점 |
|---|---|---|
| 개발자 (`dev`) | 기술 의사결정 / 트러블슈팅 | 변경이 **검증**되고 남은 부채가 드러났을 때 |
| 마케터 (`marketer`) | 캠페인 / 실험 | 반응을 보고 **귀인 한계**까지 판단했을 때 |
| 기획·PM (`pm`) | 제품 의사결정 | 가설이 검증되어 **판단이 바뀌었을 때** |

이 차이 때문에 세 직군은 같은 템플릿을 쓸 수 없다.
개발자에게 "타깃 세그먼트"를 묻거나 마케터에게 "재현 조건"을 묻는 것은
빈칸을 만들거나 억지 답변을 유도한다.

---

## 4. 개발자 (`dev`)

### 4.1 구조

```
symptom → reproduction → rootCauseHypotheses → diagnosticEvidence
        → options → technicalDecision → verification → remainingDebt
```

특화 섹션: `시스템 아키텍처 & 설계` / `트러블슈팅 및 로직` / `코드 최적화 성과`

### 4.2 근거

**① 재현과 원인 추적을 분리한 것 — Google SRE 포스트모템**

Google SRE의 포스트모템 문화는 개인을 지목하지 않고 **기여 원인(contributing causes)**을 규명하는 데 초점을 둔다.
"고쳤다"가 아니라 **무엇이 왜 무너졌는지**를 재구성하는 것이 조직 역량으로 취급된다.
`reproduction`(재현 조건)과 `rootCauseHypotheses`·`diagnosticEvidence`(검토한 가설과 그것을 버린 근거)를
별도 필드로 둔 근거다. 이 셋이 없으면 "버그를 수정했습니다" 한 문장만 남는다.

**② 대안과 선택 기준을 요구한 것 — Google 코드 리뷰 기준**

Google의 엔지니어링 관행 문서는 리뷰어가 **설계·기능·복잡도·테스트·네이밍·주석·문서**를 본다고 명시한다.
핵심 판단 기준은 "이 변경이 시스템의 전체 코드 건강도를 개선하는가"이며, 완벽함이 아니다.
즉 평가 대상은 결과물 자체가 아니라 **trade-off를 동반한 판단**이다.
`options`와 `technicalDecision`을 분리한 이유이며, 대안 없는 선택은 판단이 아니라 관성으로 본다.

**③ 검증과 잔여 부채를 강제한 것 — DORA**

DORA는 소프트웨어 전달을 **변경 리드타임·배포 빈도·실패 배포 복구 시간·변경 실패율**로 함께 본다.
속도만 보거나 안정성만 보지 않는다. 성과를 개선 수치 하나로 끝내지 않고
`verification`(테스트·모니터링·전후 지표)과 `remainingDebt`(남은 한계)를 함께 요구하는 근거다.
운영을 아는 지원자는 자기 변경의 부작용을 말할 수 있다.

### 4.3 막으려는 실패

- 기술 스택 나열을 역량으로 간주하는 것
- 커밋 수를 기여 품질로 해석하는 것

---

## 5. 마케터 (`marketer`)

### 5.1 구조

```
businessProblem → target → audienceInsight → channels → creative
                → experimentOptions → kpis[{name, value, decisionUse}]
                → attributionLimit → nextExperiment
```

특화 섹션: `캠페인 스토리 (문제 → 목표·KPI → 타깃 → 전략 → 실행 → 성과 → 인사이트)`

### 5.2 근거

**① `kpis`를 객체로 만든 것 — 숫자가 아니라 숫자로 내린 판단**

`kpis`는 단순 수치 배열이 아니라 `{name, value, decisionUse}` 객체다.
`decisionUse`는 **"이 값을 보고 무엇을 바꿨는가"**를 강제한다.
조회수 250만은 그 자체로 역량의 증거가 아니다. 그 숫자를 보고 예산·메시지·타깃을 어떻게 조정했는지가 증거다.

**② `attributionLimit` — 이 직군에만 있는 필드**

Google Ads는 **의미 있는 전환 행동**과 **고객 경로**, **귀인 모델**을 명확히 분리해 다룬다.
더 나아가 Google은 광고의 진짜 인과 효과를 재는 방법으로 **Conversion Lift(증분성) 실험**을 제공한다.
노출 집단과 통제 집단을 나눠 **광고 때문에 추가로 발생한 전환**만 분리하는 방식이다.

이 개념이 존재한다는 사실 자체가, 일반적인 성과 수치가 **인과가 아니라 상관**임을 전제한다.
마케팅 성과는 외부 변수와 다중 접점이 섞여 단일 원인으로 단정하기 어렵다.
귀인 한계를 스스로 말하는 지원자와 마지막 접점을 전부 자기 성과로 쓰는 지원자는 수준이 다르며,
`attributionLimit`은 그 차이를 드러내기 위해 존재한다.

**③ 수치 부재 시 대체 지표 — 신입·인턴 현실 반영**

신입·인턴은 성과 지표 접근 권한이 없는 경우가 많다.
수치가 없으면 `[확인 필요]`로 표기하고 **대체 지표**(제작물 수·운영 기간·게시 빈도·실험 횟수·정성 피드백)를 제안하게 했다.
없는 숫자를 지어내는 것을 막으면서 경험 자체는 살리기 위한 장치다.

### 5.3 막으려는 실패

- 마지막 접점을 전체 성과의 원인으로 단정하는 것
- 조회수와 비즈니스 성과를 분리하지 않는 것

---

## 6. 기획 / PM (`pm`)

### 6.1 구조

```
problemSignal → hypothesis → successCriteria → decision → alternatives
             → stakeholders → obstacle → resolution → validation
             → impact(1~5) / effort(1~5)
```

특화 섹션: `제품 판단 원칙` / `성공 신호 및 검증 기준`

### 6.2 근거

**① `hypothesis`에 실행·성과 문장을 금지한 것 — Amazon Working Backwards**

이 직군에서 가장 강하게 건 제약이다. `hypothesis`는 **검증 전의 믿음을 짧은 현재형으로만** 쓰게 하고,
"베타 테스트를 설계했다", "팔로워 481명을 확보했다" 같은 실행·결과 문장을 명시적으로 금지한다.

Amazon의 Working Backwards는 제품을 만들기 **전에** 출시일 보도자료와 FAQ(PR/FAQ)를 먼저 쓴다.
고객 경험을 먼저 정의하고 거기서 거꾸로 내려오는 방식이다.
핵심은 **결정 이전의 사고를 문서로 남긴다**는 것이다.

검증 전 믿음이 남아 있어야 **판단이 바뀌었는지**를 볼 수 있다.
가설 자리에 결과를 적으면 "다 잘 됐다"는 회고만 남고, PM 역량의 핵심인 학습이 사라진다.

**② `successCriteria`를 사전 정의로 요구한 것 — Atlassian PRD + Google HEART**

Atlassian의 PRD 구조는 목적·고객 요구·목표·가정·사용자 스토리·디자인·**범위 밖 항목**·성공 지표·역할·릴리스 상태를 포함한다.
성공 지표가 문서의 구성요소라는 것은, 그것이 **사후 해석이 아니라 사전 합의**임을 뜻한다.

무엇을 성공 지표로 삼을지에 대해서는 Google의 **HEART 프레임워크**(Rodden·Hutchinson·Fu, CHI 2010)를 참고했다.
HEART는 사용자 경험을 Happiness·Engagement·Adoption·Retention·Task success 다섯 축으로 계량화하고,
각 축에 대해 **Goals → Signals → Metrics** 순으로 내려간다.
목표를 먼저 정하고 그것을 관찰 가능한 신호로, 다시 지표로 번역하는 순서다.

FitPoly가 `successCriteria`(실행 전 정한 성공·반증 기준)와 `validation`(실제 검증 방법·근거)을 분리하고,
PM 시각화 블록을 `goals`(target/actual/achieved) + `kpis`로 구성한 것이 이 순서를 그대로 옮긴 것이다.
성공 기준을 사후에 만들면 어떤 결과든 성공이 된다.

**③ `alternatives`와 `obstacle`/`resolution`을 나눈 것**

`alternatives`는 **하지 않기로 한 것**(PRD의 범위 밖 항목에 해당)을,
`obstacle`/`resolution`은 **실행 중 부딪힌 제약과 돌파 방법**을 담는다.
기획서만 쓰고 끝난 경험과 실제로 밀어붙인 경험을 구분하는 축이다.

**④ `impact`/`effort`를 1~5 정수로 강제한 것**

두 값은 **Impact × Effort 우선순위 매트릭스** 좌표로 시각화된다.
PM 역량은 "무엇을 했는가"보다 **"제한된 리소스에서 무엇을 먼저 했는가"**에서 드러나므로,
결정을 좌표 위에 놓을 수 있게 수치화한다.

### 6.3 막으려는 실패

- PRD를 출시·사용 효과의 증거로 쓰는 것
- 팀 전체의 실행을 PM 단독 성과로 쓰는 것

---

## 7. 세 축 비교

| | 개발자 | 마케터 | 기획·PM |
|---|---|---|---|
| **증명 대상** | 원인 추적과 기술 판단 | 가설 검증과 판단 조정 | 우선순위 결정과 학습 |
| **강한 증거** | 저장소·PR·로그·테스트·배포 기록 | 브리프·소재·미디어 플랜·전환/CRM 분석 | PRD·리서치·실험·결정 로그·릴리스 기록 |
| **핵심 지표** | 응답시간·오류율·커버리지·복구시간 | CTR·CVR·CPA/ROAS·잔존·증분 | 활성화·잔존·전환·가치 도달 시간 |
| **고유 요구** | 남은 기술 부채 | 귀인 한계 | 검증 전 가설 |
| **가장 흔한 실패** | 스택 나열 | 조회수 = 성과 | 계획서 = 결과 |

세 직군 모두 공통 층(판단 → 대안 → 기준 → 실행 → 검증 → 변화)은 동일하다.
**다른 것은 그 판단을 무엇으로 증명하느냐**뿐이다.

이 관점은 UX 분야에서도 확인된다. Nielsen Norman Group의 UX 커리어 조사에서
채용 담당자는 포트폴리오의 **작업 흐름·사고 과정과 지원자가 직접 한 일**을 중시한다고 보고됐다.
결과물 모음이 아니라 판단 과정을 본다는 점은 직군을 가로지르는 공통 요구다.

---

## 8. 시각화 분기

같은 근거로 결과 화면의 차트도 갈린다. 데이터가 존재하는 형태가 다르기 때문이다.

| 직군 | 블록 | 이유 |
|---|---|---|
| 마케터 | `kpis`, `funnel`, `mix`, `compare` | 캠페인은 퍼널(노출→클릭→전환)과 채널 믹스로 관찰된다 |
| 기획·PM | `goals`, `kpis` | HEART의 Goals→Signals→Metrics 순서를 옮긴 것 |

`goals`에는 "숫자가 없으면 인터뷰·사용성 테스트 등 정성 근거를 수치처럼 창작하지 말 것"이 명시돼 있다.
PM 경험은 정성 근거로 판단하는 경우가 많아, 억지 수치화를 막기 위한 조건이다.

> **미해결 항목**: 현재 `dev`는 `JOB_VISUAL_GUIDES`에 전용 매핑이 없어 기본 동작을 따른다.
> 전후 성능 `compare`, 아키텍처·파이프라인 `process` 같은 블록을 넣을 여지가 남아 있다.

---

## 9. 참고 문헌

### 공통 층
- [O\*NET Content Model](https://www.onetcenter.org/content.html) · [O\*NET Overview](https://www.onetcenter.org/overview.html)
- [NACE Career Readiness Competencies](https://www.naceweb.org/career-readiness/competencies/career-readiness-defined)
- [Nielsen Norman Group, UX Careers Report](https://media.nngroup.com/media/reports/free/UserExperienceCareers_2nd_Edition.pdf)

### 개발자
- [Google SRE Book — Postmortem Culture](https://sre.google/sre-book/postmortem-culture/) · [SRE Workbook](https://sre.google/workbook/postmortem-culture/)
- [Google Engineering Practices — Code Review](https://google.github.io/eng-practices/review/) · [The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html)
- [DORA Guides](https://dora.dev/guides/) · [DORA Metrics History](https://dora.dev/insights/dora-metrics-history/)

### 마케터
- [Google Ads — Attribution Models](https://support.google.com/google-ads/answer/6259715) · [Attribution Reports](https://support.google.com/google-ads/answer/1722023)
- [Google Ads — Conversion Lift based on users](https://support.google.com/google-ads/answer/14102450)
- [Think with Google — Incrementality Testing](https://business.google.com/en-all/think/measurement/incrementality-testing/)

### 기획 · PM
- [Atlassian — Product Requirements](https://www.atlassian.com/agile/product-management/requirements)
- Rodden, Hutchinson, Fu, *Measuring the User Experience on a Large Scale: User-Centered Metrics for Web Applications*, ACM CHI 2010 — [해설](https://ixdf.org/literature/article/google-s-heart-framework-for-measuring-ux)
- [Working Backwards — PR/FAQ Process](https://workingbackwards.com/concepts/working-backwards-pr-faq-process/) · [템플릿](https://workingbackwards.com/resources/working-backwards-pr-faq/) · [About Amazon: 내부 문화와 프로세스](https://www.aboutamazon.com/news/workplace/an-insider-look-at-amazons-culture-and-processes)

---

## 10. 구현 위치

| 내용 | 파일 |
|---|---|
| 직군 프로필 (단위·산출물·지표·주의·스키마) | `backend/src/prompts/careerFieldProfiles.js` |
| 추출 가이드·스키마·시각화 매핑 | `backend/src/prompts/experiencePrompts.js` |
| 화면 직군 선택·특화 섹션 | `frontend/src/stores/experienceStore.js` |
| 별칭·과거 데이터 호환 | `frontend/src/utils/experienceCompatibility.js` |
| 자료→주장 근거 표시 | `frontend/src/pages/experience/StructuredResult.jsx` |
| 입력 자료 판독 (PPTX/XLSX/ZIP 포함) | `backend/src/services/importService.js` |

전 직군 평가 매트릭스(23개 분야)와 나머지 직군의 분야별 기준은
[career-field-evidence-research-2026.md](./career-field-evidence-research-2026.md)에 있다.
