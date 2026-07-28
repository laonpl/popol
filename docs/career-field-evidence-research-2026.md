# FitPoly 직군별 경험·증거 추출 기준

조사일: 2026-07-27

## 목표와 범위

이 문서는 산출물을 곧바로 자기소개 문장으로 요약하지 않고, 먼저 자료가 실제로
증명하는 사실과 기여 범위를 판별한 뒤 지원 분야의 평가 기준에 맞는 경험을
추출하기 위한 기준이다.

세부 직업명을 전부 하드코딩하는 방식은 유지할 수 없다. FitPoly는 채용에서
유사한 증거를 요구하는 23개 대분야와 별칭 라우팅을 사용한다. 등록되지 않은
직무도 공통 렌즈로 판단·기여·검증·변화를 추출할 수 있다.

## 공통 추출 모델

O*NET은 직업을 과업, 상세 업무 활동, 요구 역량, 업무 맥락으로 나누며 수많은
직무를 같은 구조에서 비교한다. NACE는 직무를 가로지르는 준비 역량을
커뮤니케이션, 비판적 사고, 팀워크, 기술 등 여덟 영역으로 정리한다. FitPoly는
이를 다음 두 층으로 사용한다.

1. 공통 층: 상황과 과업, 문제 판단, 대안, 선택 기준, 직접 실행, 결과 근거,
   판단 변화, 기여 범위
2. 직군 층: 해당 분야에서 무엇을 한 경험 단위로 보고 어떤 자료와 지표를
   강한 증거로 평가하는지

참고:

- [O*NET Content Model](https://www.onetcenter.org/content.html)
- [O*NET Overview](https://www.onetcenter.org/overview.html)
- [NACE Career Readiness Competencies](https://www.naceweb.org/career-readiness/competencies/career-readiness-defined)

## 자료 판독 원칙

### 사실 상태

`제안 → 승인 → 실행 → 결과 확인 → 장기 효과 확인`은 서로 다른 상태다. 예를
들어 PRD는 문제 정의와 계획의 증거가 될 수 있지만 출시와 사용자 효과를
증명하지 않는다. 프로토타입은 설계·제작의 증거이지 실제 사용의 증거가 아니다.

### 근거 수준

- A: 시스템 로그, 원데이터, 실제 배포·발행물, 계약·시험 결과
- B: 본인 초안과 버전 이력, 승인 문서, 회의록, 피드백
- C: 날짜·작성자·위치가 불완전한 캡처나 정리본
- D: 지원자의 회상만 있고 연결된 자료가 없는 주장

### 충돌 처리

- 직접 기록을 회상보다 우선한다.
- 같은 종류라면 최신 버전을 우선하되, 판단 변화는 이전 버전과 함께 보존한다.
- 숫자가 다르면 기간·분모·대상·버전을 확인하기 전 하나로 합치지 않는다.
- 파일 보유 사실을 작성자나 의사결정자 증거로 간주하지 않는다.

## 분야별 포트폴리오 평가 매트릭스

| 분야 | 경험의 단위 | 우선 산출물 | 반드시 복원할 판단 | 결과·검증 신호 |
|---|---|---|---|---|
| 공통 | 판단이 바뀐 사건 | 작업 문서, 화면, 피드백, 수정 이력 | 처음 판단, 반증 신호, 대안, 기준, 기여 | 직접 자료, 전후 변화, 한계 |
| 소프트웨어 개발 | 기술 결정·트러블슈팅 | 저장소, PR, 이슈, 로그, 테스트, 아키텍처 | 재현, 원인 가설, 설계 대안과 trade-off | 테스트·모니터링, 성능·오류, 기술 부채 |
| AI/ML | 모델·실험 | 실험 로그, 데이터/모델 카드, 평가, 서빙 기록 | 데이터 분리, 베이스라인, 모델 선택, 오류 분석 | 오프라인/온라인 품질, 지연·비용·드리프트 |
| 데이터 분석/BI | 분석과 의사결정 | SQL, 노트북, 대시보드, 데이터 사전, 실험 | 질문, 지표 정의, 경쟁 가설, 편향·품질 | 재현 가능한 분석, 불확실성, 실제 액션 |
| 인프라/DevOps/SRE | 인시던트·운영 개선 | IaC, 파이프라인, 모니터링, 런북, 회고 | 탐지, 영향, 원인, 복구/영구안, 롤백 | 리드타임·배포·복구·실패·재작업 |
| 정보보안 | 위험 식별·완화 | 위협 모델, 취약점/감사 리포트, PoC, 재검증 | 자산, 공격 경로, 위험도, 통제 대안 | 재현과 수정 검증, 잔여 위험 |
| QA/테스트 | 품질 위험·검증 | 테스트 계획/케이스, 추적표, 결함, 실행 결과 | 테스트 근거, 위험 우선순위, 종료 기준 | 추적성, 결함 누출, 릴리스 판단 |
| 하드웨어/제조 R&D | 설계·시험 반복 | 요구사항, 도면, 계산/시뮬레이션, 시험, FMEA | 제약, 설계 대안, 허용오차, 실패 원인 | 실제 시험, 신뢰성·원가·안전 여유 |
| 제품/서비스 기획 | 제품 의사결정 | PRD, 리서치, 로드맵, 프로토타입, 지표 | 사용자 문제, 가설, 제외 범위, 성공·반증 기준 | 핵심 행동·가치 도달, 출시 후 판단 변화 |
| 프로젝트/프로그램 관리 | 프로젝트 통제 | 헌장, WBS, RAID, 변경 기록, 상태 보고, 인수 | 목표·범위, 의존성, 리스크, 변경 기준 | 편차, 마일스톤, 인수와 회고 |
| UX/UI 디자인 | 리서치 기반 반복 | 리서치 원문, 플로우, 시안, 프로토타입, 테스트 | 행동 근거, 문제 해석, 시안 비교, 디자인 원칙 | 과업 성공·오류·시간, 피드백 후 실제 변화 |
| 마케팅/그로스 | 캠페인·실험 | 브리프, 소재, 미디어 플랜, 전환/CRM 분석 | 타깃 근거, 메시지·채널 가설, 확대/중단 기준 | 고객 경로, 전환, 증분 효과와 귀인 한계 |
| 콘텐츠/미디어 | 콘텐츠 판단·제작 | 브리프, 원고/대본, 초안·수정본, 발행물, 분석 | 독자 목적, 조사, 포맷·편집 판단, 수정 이유 | 완독·유지·저장·공유, 정성 반응 |
| 인사/채용 | 사람 제도·프로그램 | JD, 퍼널, 스코어카드, 서베이, 제도안, 온보딩 | 진단, 공정성·윤리·법규·수용성, 도입 | 리드타임·전환·수락·리텐션, 부작용 |
| 영업/사업개발 | 고객 기회·딜 | 계정 조사, CRM, 디스커버리, 제안/데모, 계약 | 자격 판단, 구매 기준, 반대·협상, 실주 이유 | 단계 전환, 사이클, 계약·갱신·확장 |
| 고객 성공/서비스 운영 | 고객 가치 실현 | 티켓/VOC, 여정, 온보딩, 런북, 사용·갱신 기록 | 고객 목표, 반복 원인, 해결·예방·에스컬레이션 | 해결·재문의, 채택·만족·잔존·갱신 |
| 재무/회계/투자 | 재무 판단·통제 | 모델, 예산/예측, 투자 메모, 감사 조서, 통제 | 출처·가정, 시나리오·민감도, 검산·윤리 | 편차, 현금·수익성, 오류·조정, 의사결정 반영 |
| 전략/컨설팅 | 구조화된 문제 해결 | 워크플랜, 시장·고객 조사, 모델, 제안, 실행 추적 | 핵심 질문, 가설 우선순위, 대안·반론 | 권고 채택, 실행 조건, 결과·예측 편차 |
| 운영/공급망/생산 | 프로세스 개선 | 프로세스 맵, SOP, 운영 데이터, 원인 분석, 파일럿 | 범위·기준선, 근본 원인, 대안 시험 | 리드타임·재고·불량·원가와 통제 유지 |
| 연구/R&D | 연구 질문·검증 | 계획/프로토콜, 랩 노트, 데이터/코드, 논문, 리뷰 | 문헌 공백, 방법 선택, 재현·부정 결과 | 효과와 불확실성, 역할별 기여, 한계 |
| 교육/교수설계 | 학습 설계·평가 | 요구 분석, 수업안, 활동, 루브릭, 학습 결과 | 학습자 진단, 목표-활동-평가 정렬, 포용성 | 숙달·전이, 사전-사후, 재설계 |
| 공공/정책/행정 | 정책 설계·평가 | 정책 메모, 공공데이터, 논리모형, 집행·평가 | 대상, 대안, 가정·위험, 형평성 | 투입-산출-성과-영향, 모니터링/평가 구분 |
| 법무/컴플라이언스 | 쟁점 분석·통제 | 검토 메모, 계약 조항, 규정, 실사, 시정 기록 | 사실-쟁점, 권위 근거, 불확실성, 위험 대안 | 승인·통제·시정, 예외와 잔여 위험 |
| 보건의료/헬스케어 | 안전한 품질 개선 | 비식별 사례, 프로토콜, 품질지표, 안전 기록 | 근거·지침, 안전·사람 중심·형평성, 역할 범위 | 안전·효과·적시성·경험·효율과 부작용 |

## 분야별 공식 기준에서 반영한 핵심

### 소프트웨어 운영과 AI

DORA의 현재 소프트웨어 전달 지표는 변경 리드타임, 배포 빈도, 실패 배포 복구
시간, 변경 실패율, 배포 재작업률을 함께 본다. Google의 프로덕션 ML 가이드는
학습·검증·테스트 분리, 데이터/특징 드리프트, 훈련-서빙 차이, 코드·모델·데이터
버전, 지연·처리량·비용, 배포와 롤백을 함께 관리한다.

- [DORA Guides](https://dora.dev/guides/)
- [DORA Metrics History](https://dora.dev/insights/dora-metrics-history/)
- [DORA Platform Engineering](https://dora.dev/capabilities/platform-engineering/)
- [Google Production ML Monitoring](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring)
- [Google Managing ML Projects: Production](https://developers.google.com/machine-learning/managing-ml-projects/production)

### QA와 보안

ISTQB는 테스트 목적과 근거, 계획·분석·설계·구현·실행·모니터링·종료, 테스트
산출물과 추적성을 구분한다. OWASP ASVS는 보안을 도구 사용이 아니라 적절한
보증 수준의 요구사항과 실제 검증 증거로 다룬다.

- [ISTQB CTFL Syllabus v4.0.1](https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf)
- [OWASP ASVS Guide](https://devguide.owasp.org/en/06-verification/01-guides/03-asvs/)

### 제품, 디자인, 데이터와 마케팅

Atlassian의 PRD 구조는 목적, 고객 요구, 목표, 가정, 사용자 스토리, 디자인,
범위 밖 항목, 성공 지표, 역할과 릴리스 상태를 포함한다. Nielsen Norman
Group의 UX 커리어 조사에서 채용 담당자는 포트폴리오의 작업 흐름·사고 과정과
지원자가 직접 한 일을 중시한다. Tableau는 분석 스토리에서 목적과 청중,
근거에서 결론으로 이어지는 순서와 주석·필터 가능한 뷰를 강조한다. Google Ads는
의미 있는 전환 행동, 고객 경로와 귀인 모델을 분리한다.

- [Atlassian Product Requirements](https://www.atlassian.com/agile/product-management/requirements)
- [Nielsen Norman Group UX Careers Report](https://media.nngroup.com/media/reports/free/UserExperienceCareers_2nd_Edition.pdf)
- [Tableau Story Best Practices](https://help.tableau.com/current/pro/desktop/en-us/story_best_practices.htm)
- [Google Ads Attribution Models](https://support.google.com/google-ads/answer/6259715)
- [Google Ads Attribution Reports](https://support.google.com/google-ads/answer/1722023)

### 인사, 영업과 프로젝트 관리

SHRM BASK는 HR 전문 지식과 함께 윤리, 관계 관리, 커뮤니케이션, 비즈니스
이해, 자문과 비판적 평가를 요구한다. Salesforce의 영업 과정은 조사, 잠재 고객
발굴, 세일즈 콜·클로징, 관계 형성을 연결한다. PMI는 프로젝트 역량을 지식,
실제 수행, 개인 행동의 세 차원과 성과 기준·증거로 평가한다.

- [SHRM BASK](https://www.shrm.org/credentials/certification/exam-preparation/bask)
- [Salesforce Sales Process](https://trailhead.salesforce.com/content/learn/modules/build-a-sales-process/learn-about-the-sales-process)
- [PMI Project Manager Competency Development Framework](https://www.pmi.org/standards/pm-competency-development-third-edition)
- [PMI Talent Triangle](https://www.pmi.org/certifications/certification-resources/maintain/talent-triangle)

### 재무, 운영과 연구

IMA의 관리회계 역량은 전략·계획·성과, 보고·통제, 기술·분석, 사업 운영,
리더십, 윤리와 함께 위험·거버넌스를 다룬다. CFA 기준은 결과가 나빴다는 사실만
으로 역량 부족을 단정하지 않고 지식·기술·주의의무·윤리를 본다. ASQ DMAIC는
문제와 VOC, 기준선, 근본 원인, 대안 시험, 표준화와 반응 계획을 연결한다.
ASCM SCOR는 프로세스, 성과, 관행, 사람/역량을 함께 본다. NISO CRediT은
연구 기여를 14개의 표준 역할로 분리한다.

- [IMA Management Accounting Competencies](https://prod.imanet.org/career-resources/management-accounting-competencies/)
- [CFA Competence Standard](https://www.cfainstitute.org/standards/professionals/code-ethics-standards/standards-of-practice-i-e)
- [ASQ DMAIC](https://asq.org/quality-resources/dmaic)
- [ASCM SCOR Digital Standard Introduction](https://www.ascm.org/globalassets/ascm_website_assets/docs/intro-and-front-matter-scor-digital-standard2.pdf)
- [NISO CRediT Standard](https://www.niso.org/publications/z39104-2022-credit)

### 교육, 정책과 보건의료

ISTE Educator Standards는 학습자, 리더, 시민, 협력자, 설계자, 촉진자,
분석가 역할과 데이터·대안 평가를 강조한다. OECD는 정책의 목표·가정·위험과
투입-산출-성과-영향을 연결하고 모니터링과 인과 평가를 구분한다. WHO는
의료 품질을 안전성, 효과성, 사람 중심성, 적시성, 형평성, 통합성, 효율성으로
보고 지표 데이터 품질과 의도치 않은 결과를 함께 확인한다.

- [ISTE Standards for Educators](https://iste.org/standards/educators)
- [OECD Public Policy Monitoring and Evaluation](https://www.oecd.org/en/topics/public-policy-monitoring-and-evaluation.html)
- [OECD Results Framework](https://www.oecd.org/en/publications/monitoring-and-evaluation-of-child-and-youth-policies-and-outcomes-in-ireland_2bd86a9d-en/full-report/component-5.html)
- [WHO Quality of Care](https://www.who.int/health-topics/quality-of-care)
- [WHO Quality Measurement Guide](https://www.who.int/publications/i/item/9789240105737)

## 구현 연결

- 백엔드 직군·산출물 기준: `backend/src/prompts/careerFieldProfiles.js`
- 경험 분석 프롬프트: `backend/src/prompts/experiencePrompts.js`
- PPTX/XLSX/ZIP 포함 입력 판독: `backend/src/services/importService.js`
- 화면 직군 선택과 특화 섹션: `frontend/src/stores/experienceStore.js`
- 과거 데이터/별칭 호환: `frontend/src/utils/experienceCompatibility.js`
- 자료→주장 근거 장부 화면: `frontend/src/pages/experience/StructuredResult.jsx`

