# 포트폴리오 제작 기능 구현 정리

## 1. 전체 흐름 요약

```
사용자
 │
 ├─ PortfolioHub (목록) ──────────────────────── Firebase Firestore
 │       │                                       (portfolios 컬렉션)
 │  [새 포트폴리오 클릭]
 │       │
 ├─ PortfolioTemplateSelect (템플릿 선택)
 │       │  templateId, targetCompany, targetPosition 입력
 │       │  → createPortfolio() → Firestore doc 생성 → ID 획득
 │       │
 ├─ NotionPortfolioEditor (에디터)  ◀── 자동 저장 (2초 debounce)
 │       │  섹션별 데이터 입력 / AI 추천 적용 / 드래그 순서 변경
 │       │
 │  [미리보기 / 공개 링크]
 │       │
 ├─ NotionPortfolioPreview / PublicPortfolioView
 │
 │  [내보내기]
 │       │
 └─ ExportModal → /api/export/* or /api/portfolio/ai-ppt-analyze
                  → AiPptExport (PPT 내보내기)
```

---

## 2. 라우팅 구조 (App.jsx)

| URL 경로 | 컴포넌트 | 설명 |
|---|---|---|
| `/app/portfolio` | `PortfolioHub` | 포트폴리오 목록 |
| `/app/portfolio/new` | `PortfolioTemplateSelect` | 템플릿 선택 + 기업/직무 입력 |
| `/app/portfolio/edit/:id` | `NotionPortfolioEditor` | 메인 에디터 |
| `/app/portfolio/edit-notion/:id` | `NotionPortfolioEditor` | (동일 컴포넌트, 레거시 URL) |
| `/app/portfolio/preview/:id` | `NotionPortfolioPreview` | 렌더링 미리보기 |
| `/app/portfolio/ai-ppt/:id` | `AiPptExport` | AI PPT 내보내기 |
| `/p/:id` | `PublicPortfolioView` | 공개 공유 URL (인증 불필요) |

모든 `/app/*` 경로는 `PrivateRoute` + `ProfileGuard`로 보호됨.  
코드 스플리팅(`React.lazy`)으로 각 페이지를 지연 로드.

---

## 3. 데이터 저장소 — Firebase Firestore

### 컬렉션: `portfolios`

| 필드 | 타입 | 설명 |
|---|---|---|
| `userId` | string | Firebase Auth UID |
| `title` | string | 포트폴리오 제목 |
| `targetCompany` | string | 목표 기업명 |
| `targetPosition` | string | 지원 직무 |
| `templateType` | string | `notion` / `academic` / `ashley` / `timeline` / `visual-N` |
| `templateId` | string | 세부 템플릿 ID |
| `headline` | string | 한 줄 소개 |
| `education` | array | 학력 항목 |
| `experiences` | array | 경험/프로젝트 항목 |
| `awards` | array | 수상/장학금 |
| `skills` | object | `{ tools, languages, frameworks, others }` |
| `goals` | array | 목표와 계획 |
| `valuesEssay` | string | 가치관/자기소개 텍스트 |
| `valuesEssayBlocks` | array | Rich 콘텐츠 블록 (텍스트+이미지 혼합) |
| `contact` | object | `{ phone, email, linkedin, github, website, ... }` |
| `curricular` | object | 교과 활동 |
| `extracurricular` | object | 비교과 활동 |
| `activityRecords` | array | 타임라인 활동 기록 |
| `sections` | array | 구버전 PortfolioEditor 섹션 |
| `jobAnalysis` | object | 채용공고 AI 분석 결과 |
| `isPublic` | boolean | 공개 공유 여부 |
| `checklist` | object | 6항목 통과 여부 |
| `status` | string | `draft` / `exported` |
| `yooptaContent` | object | Yoopta 에디터 콘텐츠 |
| `createdAt` / `updatedAt` | timestamp | Firestore ServerTimestamp |

---

## 4. 상태 관리 — portfolioStore.js (Zustand)

### 주요 액션

| 함수 | 설명 |
|---|---|
| `fetchPortfolios(userId)` | Firestore 쿼리 → 사용자 포트폴리오 로드, 최신순 정렬 |
| `createPortfolio(userId, data)` | Firestore `addDoc` → 새 doc 생성 후 ID 반환 |
| `updatePortfolio(id, data, prevSnapshot)` | diff 비교 후 변경된 최상위 키만 `updateDoc` |
| `deletePortfolio(id)` | Firestore `deleteDoc` + 로컬 상태 제거 |
| `setCurrentPortfolio(p)` | 현재 편집 중인 포트폴리오 세팅 |
| `runChecklist(portfolioId)` | 6항목 검증 실행 (아래 상세) |
| `exportPortfolio(portfolioId, format)` | 내보내기 실행 (PDF / Notion / GitHub) |
| `matchSectionsToRequirements(...)` | 직무 요건 vs 섹션 매칭 AI 분석 |

### updatePortfolio의 diff 최적화

```js
// prevSnapshot과 비교하여 변경된 키만 Firestore로 전송
const updatedFields = prevSnapshot
  ? Object.fromEntries(
      Object.entries(data).filter(
        ([k, v]) => JSON.stringify(v) !== JSON.stringify(prevSnapshot[k])
      )
    )
  : data;
if (Object.keys(updatedFields).length === 0) return; // 변경 없으면 스킵
```

---

## 5. 템플릿 시스템

### 5.1 Notion형 템플릿 (NotionPortfolioEditor)

에디터 내부에서 `templateType` 값으로 렌더링 스타일 분기.

| templateType | 특징 |
|---|---|
| `notion` | 3단 레이아웃 (프로필, 학력, 경험, 기술, 수상, 목표, 가치관, 연락처) |
| `academic` | 대학생/취준생용, 학술 중심 (학력·연구·활동 타임라인) |
| `ashley` | 인터뷰·저서·강연 섹션 포함, 퍼스널 브랜딩형 |
| `timeline` | 학기별 수업 및 활동 타임라인 중심 |

각 `templateType`마다 표시할 섹션 목록이 `TEMPLATE_SECTION_MAP`으로 정의됨:

```js
const TEMPLATE_SECTION_MAP = {
  notion:   ['profile','education','awards','experiences','curricular','extracurricular','skills','goals','values','contact'],
  academic: ['profile','education','awards','experiences','curricular','extracurricular','skills','goals','values','contact'],
  ashley:   ['profile','education','awards','experiences','interviews','books','lectures','skills','goals','values','funfacts','contact'],
  timeline: ['profile','education','curricular','experiences','goals','skills','awards','contact'],
};
```

### 5.2 비주얼 템플릿 (VisualPortfolioTemplates.jsx)

`templateId`가 `visual-1` ~ `visual-10+` 인 경우 `VisualPortfolioRenderer` 컴포넌트로 렌더링.  
각 비주얼 템플릿은 디자인 토큰(bg, accent, fontHeading, layoutHint 등)을 가짐.

`PortfolioTemplateSelect`에서 선택할 수 있는 템플릿 목록 (예시):

| ID | 이름 | 대상 |
|---|---|---|
| `notion` | 템플릿 1 (3단 레이아웃) | 전 직군 |
| `academic` | 템플릿 2 (학술 타임라인) | 전 직군 |
| `visual-1` ~ `visual-10+` | 다양한 비주얼 스타일 | 개발자/PM/디자이너 등 직군별 |

---

## 6. 편집기 — NotionPortfolioEditor.jsx

### 핵심 기능

#### 자동 저장 (2초 debounce)
```
portfolio state 변경
   → 2초 대기
   → updatePortfolio(id, data) 호출 (diff만 전송)
```

#### 편집 모드 전환
URL 파라미터 `?mode=form`으로 폼 모드 / 기본은 비주얼 모드.

#### 섹션 구조
- 좌측 사이드바: 섹션 목록 네비게이션 (SECTIONS_BASE 배열 기반)
- 우측 편집 영역: 활성 섹션에 따라 다른 입력 폼 렌더링
- 섹션 숨기기 / 순서 변경 가능 (hiddenSections, sectionOrder 필드)
- 섹션 이름 커스텀 (customSectionLabels 필드)

#### 경험 연동
- `experiences` 컬렉션에서 사용자가 이미 작성한 경험을 불러와 포트폴리오에 임포트
- 경험의 `structuredResult`(STAR 분석 결과)가 포트폴리오 섹션에 자동 삽입됨

#### AI 추천 적용 (섹션별)
`applySectionRecommendationToPortfolio()` 함수가 섹션 타입에 따라 AI 추천 결과를 적절한 필드에 삽입:

| 섹션 타입 | 적용 대상 |
|---|---|
| `education` | `education` 배열에 항목 추가 |
| `awards` | `awards` 배열에 항목 추가 |
| `skills` | `skills.others` 배열에 항목 추가 |
| `goals` | `goals` 배열에 항목 추가 |
| `values` / `profile` | `valuesEssay` / `valuesEssayBlocks` 에 텍스트 추가 |
| `experiences` / `projects` | `experiences` 배열에 새 경험 추가 |
| `extracurricular` | `extracurricular.details` 에 항목 추가 |

---

## 7. 백엔드 API — portfolio 라우트

### POST `/api/portfolio/validate`
**체크리스트 6항목 검증**

| 항목 | 처리 위치 | 방식 |
|---|---|---|
| `fileSize` | 백엔드 | Firestore doc JSON 크기 측정 (20MB 기준) |
| `format` | 프론트엔드 | exportFormat 필드 존재 여부 |
| `naming` | 프론트엔드 | 파일명 네이밍 룰 검사 |
| `customization` | 백엔드 AI | Gemini로 기업/직무 맞춤형 여부 판단 |
| `contribution` | 백엔드 AI | 팀 프로젝트 기여도 명시 여부 |
| `proofread` | 백엔드 AI | 오타/비문 검사 |

1. 관련 경험 데이터(최대 10개)도 함께 Firestore에서 조회
2. `validatePortfolioWithAI()` 호출 → Gemini 단일 프롬프트로 3가지 AI 항목 동시 검증
3. 결과를 Firestore `portfolios/{id}.checklist`에도 업데이트

### POST `/api/portfolio/ai-ppt-analyze`
**Notion 스타일 AI PPT 슬라이드 생성**

```
포트폴리오 데이터 + templateHint
   → buildDeckFromPortfolio() (결정적 슬라이드 생성)
   → buildAiPptAnalyzePrompt()
   → Gemini Pro 호출
   → mergeDecksWithPolish() (AI 결과를 기본 덱에 병합)
   → { deck: { slides: [...] } } 반환
```

### POST `/api/portfolio/ai-ppt-revise`
**특정 슬라이드 AI 수정**

```
slide 데이터 + instruction (사용자 지시)
   → buildAiPptRevisePrompt()
   → Gemini Pro 호출
   → 수정된 slide 객체 반환
```

### POST `/api/portfolio/match-sections`
**섹션-직무 요건 매칭**

```
sections[] + targetCompany + targetPosition
   → buildMatchSectionsPrompt()
   → Gemini 호출
   → [{ index, matched, relevance, reason }] 배열 반환
```

---

## 8. 내보내기 시스템

### 8.1 내보내기 흐름

```
ExportModal (프론트엔드)
   │
   ├─ PDF    → /api/export/pdf    → exportForPDF()    → Gemini AI 최적화 텍스트 → 클라이언트 렌더링
   ├─ Notion → /api/export/notion → exportForNotion() → Gemini AI Markdown 변환
   │         → /api/export/notion-page → Notion API로 실제 페이지 생성
   └─ GitHub → /api/export/github → exportForGitHub() → Gemini AI README.md 변환
```

### 8.2 AI PPT 내보내기 (2가지 경로)

**경로 A: 기본 템플릿 (Notion 스타일 슬라이드)**
```
AiPptExport 선택 → /api/portfolio/ai-ppt-analyze
   → Gemini Pro로 deck 생성
   → exportDeckToPptx() (aiPptTemplates.jsx의 클라이언트 렌더러)
   → .pptx 파일 다운로드
```

**경로 B: 사용자 PPTX 템플릿 업로드**
```
사용자 .pptx 업로드 → /api/export/ppt (multipart/form-data)
   → parsePptxLayout() — JSZip + xmldom으로 슬라이드 레이아웃 파싱
       (텍스트박스 위치/크기/폰트, 장식 도형, 이미지, 배경, 테마 색상)
   → mapDeck() — Gemini AI로 포트폴리오 내용을 슬라이드 슬롯에 매핑
   → renderDeckInPlace() — pptxRendererInPlace.js로 원본 템플릿에 인플레이스 렌더링
   → base64 PPTX 반환 → 클라이언트 다운로드
```

### 8.3 Notion API 직접 내보내기

```
ExportModal에서 Notion 토큰 + 부모 페이지 ID 입력
   → /api/export/notion-page
   → createNotionPortfolioPage() (notionExportService.js)
   → Notion API로 3컬럼 레이아웃 블록 생성
   → 생성된 페이지 URL 반환
```

---

## 9. AI 서비스 계층

### 9.1 Gemini 모델 우선순위

```
기본: gemini-2.5-pro (Pro 우선)
   └─ 실패 시 폴백: gemini-2.5-flash-lite

비핵심 작업: gemini-2.5-flash-lite 전용
```

### 9.2 포트폴리오 관련 프롬프트 (portfolioPrompts.js)

| 함수 | 용도 |
|---|---|
| `buildCoverLetterDraftPrompt()` | 자기소개서 문항 답변 초안 생성 |
| `buildValidatePortfolioPrompt()` | 체크리스트 AI 검증 (맞춤형/기여도/오타) |
| `buildMatchSectionsPrompt()` | 섹션-직무 요건 매칭 분석 |
| `buildPortfolioDistillPrompt()` | PPT 콘텐츠 팩 추출 (Stage 1) |
| `buildAiPptAnalyzePrompt()` | AI PPT 슬라이드 구조 생성 |
| `buildAiPptRevisePrompt()` | 특정 슬라이드 수정 지시 |

### 9.3 타임아웃 설정

| 엔드포인트 | 타임아웃 |
|---|---|
| 일반 API 요청 | 120초 (axios 기본) |
| `/api/portfolio/ai-ppt-analyze` | 90초 (Gemini withTimeout) |
| `/api/export/ppt` (PPTX 커스텀) | 300초 (클라이언트 설정) |

---

## 10. 인증 및 보안

- **인증**: Firebase Auth ID Token → `Authorization: Bearer <token>` 헤더
- **토큰 캐싱**: 만료 5분 전까지 인메모리 캐시 재사용 (api.js)
- **백엔드 검증**: `authMiddleware`에서 Firebase Admin SDK로 토큰 검증
- **소유권 확인**: 포트폴리오 조회 시 `portfolio.userId !== req.user.uid` 검사 → 403
- **Rate Limiting**: AI 엔드포인트에 `aiRateLimiter` 미들웨어 적용

---

## 11. 파일 구조 요약

```
frontend/src/
├── pages/portfolio/
│   ├── PortfolioHub.jsx           # 목록 페이지
│   ├── PortfolioTemplateSelect.jsx # 템플릿 선택
│   ├── NotionPortfolioEditor.jsx  # 메인 에디터 ★
│   ├── PortfolioEditor.jsx        # 구버전 섹션 에디터
│   ├── NotionPortfolioPreview.jsx # 미리보기
│   ├── PublicPortfolioView.jsx    # 공개 공유 페이지
│   ├── AiPptExport.jsx            # AI PPT 내보내기 UI
│   ├── aiPptTemplates.jsx         # PPT 슬라이드 렌더러 + 템플릿 정의
│   ├── VisualPortfolioTemplates.jsx # 비주얼 템플릿 렌더러
│   └── FreeformPortfolioEditor.jsx # 자유형 에디터
├── stores/
│   └── portfolioStore.js          # Zustand 스토어
└── services/
    └── api.js                     # Axios 클라이언트 (토큰 자동 첨부)

backend/src/
├── routes/
│   ├── portfolio.js               # /api/portfolio/* 라우트
│   └── export.js                  # /api/export/* 라우트
├── services/
│   ├── geminiService.js           # AI 호출 코어 (Pro 우선 + 폴백)
│   ├── geminiPptFunctions.js      # AI PPT 생성 함수
│   ├── exportService.js           # PDF/Notion/GitHub 내보내기
│   ├── notionExportService.js     # Notion API 직접 연동
│   ├── templateParser.js          # PPTX 레이아웃 파싱 (JSZip + xmldom)
│   ├── geminiMapper.js            # AI 슬라이드 콘텐츠 매핑
│   ├── pptxRendererInPlace.js     # PPTX 인플레이스 렌더링
│   └── jobAnalysisService.js      # 채용공고 AI 분석 + 포트폴리오 요건 추출
└── prompts/
    └── portfolioPrompts.js        # 포트폴리오 관련 프롬프트 빌더
```
