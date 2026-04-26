# 포폴 백엔드 아키텍처 설계서

> **마지막 업데이트**: 2026-04-21  
> **런타임**: Node.js ≥ 20 (ESM), Express 4  
> **AI**: Gemini 2.5 Pro/Flash/Flash-Lite + GitHub Models(gpt-4o-mini) fallback

---

## 목차

1. [디렉터리 구조](#1-디렉터리-구조)
2. [서버 진입점 (index.js)](#2-서버-진입점)
3. [환경 변수](#3-환경-변수)
4. [API 라우트 전체 목록](#4-api-라우트-전체-목록)
5. [서비스 레이어](#5-서비스-레이어)
6. [AI 엔진 (geminiClient.js)](#6-ai-엔진-geminiclientjs)
7. [미들웨어](#7-미들웨어)
8. [Firestore 데이터 모델](#8-firestore-데이터-모델)
9. [프롬프트 전략](#9-프롬프트-전략)
10. [에러 처리 흐름](#10-에러-처리-흐름)
11. [파일 업로드 & OCR 파이프라인](#11-파일-업로드--ocr-파이프라인)
12. [외부 서비스 연동 지도](#12-외부-서비스-연동-지도)
13. [의존성 패키지](#13-의존성-패키지)
14. [핵심 설계 결정 사항](#14-핵심-설계-결정-사항)

---

## 1. 디렉터리 구조

```
backend/
├── src/
│   ├── config/
│   │   ├── firebase.js          # Firebase Admin SDK (lazy init)
│   │   └── geminiClient.js      # Gemini 클라이언트 + 글로벌 요청 큐 + 모델 헬스트래커
│   ├── middleware/
│   │   ├── auth.js              # 헤더 기반 인증 (x-user-id, guest 허용)
│   │   └── rateLimiter.js       # 3단계 rate limit (사용자/글로벌/AI)
│   ├── routes/
│   │   ├── experience.js        # 경험 분석 API
│   │   ├── portfolio.js         # 포트폴리오 검증/섹션매칭 API
│   │   ├── export.js            # 다형식 내보내기 API
│   │   ├── import.js            # 다소스 가져오기 API (파일/URL)
│   │   ├── job.js               # 채용공고 분석/매칭/맞춤화 API
│   │   └── upload.js            # 이미지 업로드 API
│   ├── services/
│   │   ├── geminiService.js     # AI 비즈니스 로직 (경험분석/검증/자소서)
│   │   ├── jobAnalysisService.js# 채용공고 스크래핑 + AI 분석
│   │   ├── importService.js     # 다소스 임포트 처리 (Notion/GitHub/Blog/OCR)
│   │   ├── exportService.js     # 내보내기 포맷 변환 (Notion/GitHub/PDF)
│   │   └── notionExportService.js # Notion API 실제 페이지 생성 (3단 컬럼)
│   ├── prompts/
│   │   ├── experiencePrompts.js # 경험 분석 프롬프트 (split-step 전략)
│   │   └── portfolioPrompts.js  # 포트폴리오/자소서 프롬프트
│   └── index.js                 # Express 서버 설정 & 라우트 마운트
├── uploads/                     # 이미지 업로드 임시 저장소
├── .env                         # 환경 변수
├── nodemon.json                 # 개발서버 watch 설정 (.env 포함)
└── package.json
```

---

## 2. 서버 진입점

**`src/index.js`**

```
dotenv.config()
     ↓
Express app 생성
     ↓
미들웨어 체인
  helmet()          # 보안 헤더
  cors()            # 허용 도메인: FRONTEND_URL 환경변수
  express.json()    # 요청 본문 파싱 (10MB 제한)
     ↓
라우트 마운트
  /api/health       → 서버 상태 + 큐 통계
  /api/experience   → experience.js
  /api/portfolio    → portfolio.js
  /api/export       → export.js
  /api/import       → import.js
  /api/job          → job.js
  /api/upload       → upload.js
     ↓
글로벌 에러 핸들러
  (err, req, res, next) → 500 JSON 응답
     ↓
PORT 리슨 (기본 5000)
```

---

## 3. 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `PORT` | - | 서버 포트 (기본 5000) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API 키 |
| `GITHUB_MODELS_TOKEN` | 권장 | GitHub Models PAT (gpt-4o-mini fallback) |
| `GITHUB_MODELS_ENDPOINT` | - | 기본 `https://models.inference.ai.azure.com` |
| `FIREBASE_PROJECT_ID` | ✅ | Firebase 프로젝트 ID |
| `FIREBASE_STORAGE_BUCKET` | ✅ | Firebase Storage 버킷 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅ | 서비스 계정 JSON (전체 내용 or 파일 경로) |
| `FRONTEND_URL` | - | CORS 허용 도메인 (쉼표 구분) |

> **주의**: `nodemon.json`에서 `.env`를 watch하므로 키 변경 후 nodemon이 자동 재시작됨.  
> Gemini/Import 클라이언트 모두 lazy init 패턴 적용 → 재시작 시 새 키 즉시 반영.

---

## 4. API 라우트 전체 목록

### 4-1. 경험 분석 `/api/experience`

| 메서드 | 경로 | 인증 | Rate Limit | 설명 |
|--------|------|------|-----------|------|
| `POST` | `/analyze` | ✅ | aiRateLimiter | 경험 전체 AI 분석 (split-step 3단계 병렬) |
| `POST` | `/extract-moments` | ✅ | - | 핵심 순간 3~10개 추출 (리뷰 단계) |
| `GET` | `/list` | ✅ | - | 사용자 경험 목록 조회 |

**`/analyze` 요청/응답:**
```js
// 요청
{ experienceId, momentsCount?, reviewedMoments? }

// 응답
{
  projectOverview: { summary, background, goal, role, team, duration, techStack[] },
  keyExperiences: [{
    title, metric, metricLabel, beforeMetric, afterMetric,
    situation, action, result, keywords[], chartType
  }],
  intro, overview, task, process, output, growth, competency,
  keywords[], highlights[], followUpQuestions[]
}
```

**`/extract-moments` 요청/응답:**
```js
// 요청
{ rawText, title? }

// 응답
{ moments: [{ id, type, title, description, situation, action, result,
              metric, metricLabel, beforeMetric, afterMetric, keywords[] }] }
```

---

### 4-2. 포트폴리오 `/api/portfolio`

| 메서드 | 경로 | 인증 | Rate Limit | 설명 |
|--------|------|------|-----------|------|
| `POST` | `/validate` | ✅ | aiRateLimiter | 포트폴리오 AI 검증 (4가지 체크리스트) |
| `POST` | `/match-sections` | ✅ | aiRateLimiter | 섹션-직무 매칭 분석 |

**체크리스트 항목:**
1. **fileSize** — JSON 직렬화 크기 < 20MB (AI 불필요, 로컬 계산)
2. **customization** — 목표 직무/기업 맞춤 여부 (AI 판단)
3. **contribution** — 팀 프로젝트 기여도(%) 명시 여부 (AI 판단)
4. **proofread** — 맞춤법/오탈자 검사 (AI 판단)

---

### 4-3. 내보내기 `/api/export`

**공통 미들웨어**: `globalAiRateLimiter` + `aiRateLimiter`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/notion-page` | Notion API로 실제 페이지 생성 (3단 컬럼) |
| `POST` | `/notion-portfolio` | Notion 최적화 마크다운 생성 |
| `POST` | `/notion` | Notion 마크다운 (경량) |
| `POST` | `/github` | GitHub README.md 형식 |
| `POST` | `/pdf` | PDF 최적화 압축 텍스트 |

---

### 4-4. 가져오기 `/api/import`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| `POST` | `/notion` | ✅ | Notion URL 임포트 (4단계 폴백) |
| `POST` | `/github` | ✅ | GitHub 프로필/Gist/레포 임포트 |
| `POST` | `/blog` | ✅ | 블로그 URL 스크래핑 |
| `POST` | `/upload` | ✅ | 파일 업로드 (PDF/DOCX/이미지/HWP) |
| `POST` | `/pdf` | ✅ | PDF 텍스트 처리 (프론트 추출 후) |
| `POST` | `/text` | ✅ | 직접 텍스트 입력 |
| `POST` | `/structure` | ✅ | 임포트된 내용 AI 구조화 |

**파일 업로드 제한**: 25MB, MIME 타입 화이트리스트 적용

---

### 4-5. 채용공고 분석 `/api/job`

**공통 미들웨어**: `globalAiRateLimiter` + `aiRateLimiter`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/analyze` | 채용공고 URL/텍스트 → 구조화 분석 |
| `POST` | `/match` | 사용자 경험 ↔ 채용공고 매칭 점수 |
| `POST` | `/generate-coverletter` | 자소서 문항별 답변 병렬 생성 |
| `POST` | `/generate-portfolio` | 맞춤 포트폴리오 구성 제안 |
| `POST` | `/tailor-experience` | 경험 내용 기업 맞춤 재작성 |
| `POST` | `/tailor-portfolio` | 포트폴리오 섹션 병렬 맞춤 재작성 |
| `POST` | `/recommend-section` | 섹션 타입별 내용 추천 3가지 |
| `POST` | `/recommend-experiences` | 키워드 기반 경험 추천 |
| `POST` | `/save` | 분석 결과 저장 |
| `GET` | `/list` | 저장된 매칭 목록 조회 |

---

### 4-6. 이미지 업로드 `/api/upload`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/image` | 이미지 업로드 (5MB, diskStorage) |
| `DELETE` | `/image` | 업로드된 이미지 삭제 |

---

### 4-7. 헬스체크 `/api/health`

```js
// GET /api/health
// 응답
{ status: "ok", queue: { active, waiting, maxQueue } }
```

---

## 5. 서비스 레이어

### 5-1. geminiService.js

핵심 AI 비즈니스 로직. 라우트에서 직접 Gemini를 호출하지 않고 반드시 이 서비스를 통해 호출.

| 함수 | 설명 | AI 모델 전략 |
|------|------|-------------|
| `analyzeExperience()` | 경험 3단계 병렬 분석 | Pro 우선 (EXPERIENCE_MODEL_FALLBACKS) |
| `extractMoments()` | 핵심 순간 추출 | Pro 우선 |
| `generateCoverLetterDraft()` | 자소서 문항 답변 생성 | Pro 우선 |
| `validatePortfolioWithAI()` | 포트폴리오 AI 검증 3항목 | callProFirst |
| `matchSectionsToRequirements()` | 섹션-직무 매칭 | callProFirst |
| `callProFirst()` | Pro 시도 → 실패 시 Lite 폴백 | Pro → Flash-Lite |
| `parseJSON()` | AI 응답에서 JSON 추출 | - |
| `generateWithRetry()` | (re-export) 재시도 오케스트레이터 | - |

**`callProFirst` 내부 로직:**
```
1. Pro로 시도
2. 성공 → 반환
3. 실패:
   - 403/spending cap/leaked → 영구 오류, Lite 폴백 없이 즉시 throw
   - 그 외 → Lite(Flash-Lite)로 재시도
4. Lite도 실패 → throw
```

---

### 5-2. jobAnalysisService.js

채용공고 스크래핑과 직무 분석 전담.

| 함수 | 설명 |
|------|------|
| `scrapeJobPosting(url)` | HTTP fetch(15초) → 실패 시 Puppeteer(45초, 최대 동시 2개) |
| `analyzeJobPosting(text)` | 채용공고 텍스트 → 구조화 JSON |
| `matchExperiencesToJob()` | 경험 ↔ 요구사항 커버리지 매칭 |
| `generateTailoredCoverLetter()` | 문항별 Promise.all 병렬 생성 |
| `generateTailoredPortfolio()` | 맞춤 포트폴리오 구성 제안 |
| `tailorExperienceContent()` | 경험 7개 섹션 일괄 재작성 |
| `tailorPortfolioSections()` | 섹션별 Promise.all 병렬 재작성 |

**스크래핑 파이프라인:**
```
URL 입력
  ↓
HTTP fetch (timeout 15s, 15KB 제한)
  ├─ 성공 → script/style/nav/header/footer 제거 → 텍스트 반환
  └─ 실패 (JS 렌더링 필요)
       ↓
    Puppeteer (headless, 최대 동시 2인스턴스)
      ├─ 페이지 로드 (networkidle2, timeout 45s)
      ├─ 텍스트 추출
      └─ 브라우저 닫기
```

---

### 5-3. importService.js

다소스 임포트 처리. 각 소스별 다단계 폴백 구조.

#### Notion 임포트 (4단계 폴백)

```
1. getPublicPageData API  →  recordMap 파싱
2. loadPageChunk API      →  recordMap 파싱
3. loadCachedPageChunk    →  recordMap 파싱
4. HTML 스크래핑          →  __NEXT_DATA__ 파싱 → 태그 기반 텍스트 추출
                              ↓ 모두 실패
                          needsManualInput: true (수동 복붙 유도)
```

#### GitHub 임포트 (URL 타입 자동 감지)

```
URL 패턴 분석
  ├─ gist.github.com/user/id  → Gist API (파일 내용 추출)
  ├─ github.com/username      → 프로필 API + 레포 목록 (최근 10개)
  └─ github.com/owner/repo    → Contents API (README.md 또는 지정 파일)
                                  └─ 파일 없으면 레포 메타정보 반환
```

#### 블로그 임포트 (플랫폼별 전략)

| 플랫폼 | URL 패턴 | 전략 |
|--------|---------|------|
| Velog | velog.io | HTTP → `__NEXT_DATA__` JSON 파싱 |
| Tistory | tistory.com | HTTP → `#article-content` 선택자 |
| 네이버 블로그 | blog.naver.com | Puppeteer (iframe 구조) |
| Medium | medium.com | HTTP → `article` 태그 |
| Brunch | brunch.co.kr | HTTP → `.wrap_body_frame` |
| dev.to | dev.to | HTTP → `#article-body` |
| Hashnode | hashnode.dev | HTTP → `__NEXT_DATA__` |
| 일반 | 기타 | HTTP → 공통 선택자 → Puppeteer 폴백 |

---

### 5-4. exportService.js

포트폴리오 데이터를 다양한 형식으로 변환.

| 함수 | 형식 | 폴백 |
|------|------|------|
| `exportForNotion()` | Notion 최적화 마크다운 | AI 실패 시 `buildPortfolioMarkdown()` 템플릿 |
| `exportForGitHub()` | GitHub README (배지 포함) | 동일 |
| `exportForPDF()` | A4 최적화 압축 텍스트 | 동일 |

---

### 5-5. notionExportService.js

Notion API를 통해 실제 페이지를 생성. 포트폴리오를 3단 컬럼으로 구성.

```
컬럼 1 (프로필)       컬럼 2 (학력/연락처)    컬럼 3 (수상/경험)
─────────────────    ──────────────────────   ───────────────────
이미지               학력사항                 수상 경력
이름/영문이름         관심사                   주요 경험
헤드라인             연락처 정보              기술 스택
가치관 (callout)     소셜 링크                (inline code 블록)
```

---

## 6. AI 엔진 (geminiClient.js)

### 6-1. 모델 폴백 체인

```
DEFAULT_FALLBACKS:
  gemini-2.5-pro → gemini-2.5-flash → gemini-2.5-flash-lite

EXPERIENCE_MODEL_FALLBACKS (경험 분석):
  gemini-2.5-pro → gemini-2.5-flash-lite

PRO_ONLY_FALLBACKS:
  gemini-2.5-pro (폴백 없음)
```

### 6-2. 글로벌 요청 큐 (세마포어)

Gemini Free Tier 한도 **15 RPM**을 절대 초과하지 않도록 서버 전체 요청을 직렬화.

```
설정값
  REQUEST_INTERVAL_MS = 4100ms  (요청 간 최소 간격)
  MAX_QUEUE_SIZE = 60           (최대 대기 수)
  QUEUE_TIMEOUT = 120000ms      (대기 타임아웃 2분)

흐름
  요청 → acquireSemaphore()
    ├─ 큐 FULL → QUEUE_FULL 에러 즉시
    ├─ 타임아웃 → QUEUE_TIMEOUT 에러
    └─ 권한 획득 (4.1초 간격 보장)
         ↓
    API 호출
         ↓
    releaseSemaphore() (always in finally)
```

### 6-3. Pro 모델 헬스 트래커

```
503 에러 발생 시:
  consecutiveErrors++
  if (consecutiveErrors >= 2):
    blockedUntil = now + 60초
    → 이후 요청에서 Pro 건너뜀

성공 시:
  consecutiveErrors = 0
  blockedUntil = 0

preferPro 모드:
  헬스 트래커 무시, Pro를 강제로 시도
```

### 6-4. generateWithRetry 에러 처리 매트릭스

| HTTP 상태 | 상황 | 처리 |
|-----------|------|------|
| 400 (API key) | 잘못된 API 키 | 즉시 throw (재시도 없음) |
| 403 Forbidden | 키 유출/차단 | `skipAllGemini = true` → GitHub Models |
| 404 | 모델 없음 | 다음 모델로 즉시 이동 |
| 429 + spending cap | 월 한도 초과 | `skipAllGemini = true` → GitHub Models |
| 429 일반 | RPM/TPM 초과 | 지수 백오프 재시도 (최대 60초) |
| 500 | 서버 에러 | 지수 백오프 재시도 |
| 503 | 과부하 | Pro: preferPro면 재시도, 아니면 즉시 폴백 |
| GEMINI_TIMEOUT | 90초 초과 | 다음 모델로 이동 |

### 6-5. GitHub Models 폴백

```
트리거:
  - 모든 Gemini 모델 실패
  - 403 Forbidden
  - 429 spending cap

처리:
  prompt 길이 > 6000자 → 6000자로 자름 (한국어 1~2자/token 기준)
  System: "Always respond in valid JSON"
  Model: gpt-4o-mini
  Max input: ~4000 tokens
  Output budget: ~1500 tokens
```

---

## 7. 미들웨어

### 7-1. auth.js

```js
// 단순 헤더 기반 인증 (Firebase Auth 검증 없음)
x-user-id 헤더 → req.user = { uid, email: null }
헤더 없으면 → req.user = { uid: 'guest' }
```

> 실제 Firebase UID 검증을 추가하려면 `adminAuth.verifyIdToken()` 호출 필요.

### 7-2. rateLimiter.js (3단계)

| 이름 | 윈도우 | 최대 요청 | 키 기준 | 적용 라우트 |
|------|--------|----------|--------|------------|
| `aiRateLimiter` | 60초 | 12 | x-user-id 또는 IP | experience, portfolio/validate, export, job |
| `generalRateLimiter` | 15분 | 300 | x-user-id 또는 IP | 전체 /api |
| `globalAiRateLimiter` | 60초 | 80 | "global" (단일 키) | export, job |

```
요청 도착
  ↓ generalRateLimiter (전체 API 보호)
  ↓ globalAiRateLimiter (서버 전체 AI 요청 총량 보호)
  ↓ aiRateLimiter (사용자별 AI 요청 보호)
  ↓ authMiddleware
  ↓ Route Handler
  ↓ geminiClient 세마포어 (15 RPM 물리적 제한)
```

---

## 8. Firestore 데이터 모델

### experiences

```typescript
{
  userId: string
  title: string
  description: string          // 원본 입력 텍스트
  role: string
  startDate: string
  endDate: string
  framework: string            // "STRUCTURED" | "STAR" | 기타
  content: {
    intro: string
    overview: string
    task: string
    process: string
    output: string
    growth: string
    competency: string
  }
  structuredResult: {
    projectOverview: {
      summary, background, goal, role, team, duration, techStack: string[]
    }
    keyExperiences: Array<{
      title, metric, metricLabel
      beforeMetric, afterMetric    // 수치화 전/후
      situation, action, result
      keywords: string[]
      chartType: string            // "bar" | "line" | "none"
    }>
    intro, overview, task, process, output, growth, competency
    keywords: string[]
    highlights: string[]
    followUpQuestions: string[]
  }
  reviewedMoments: Array<{
    id, type, title, description
    situation, action, result
    metric, metricLabel, beforeMetric, afterMetric
    keywords: string[]
  }>
  momentsCount: number
  skills: string[]
  keywords: string[]
  photos: string[]               // Firebase Storage URL 목록
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### portfolios

```typescript
{
  userId: string
  title: string
  templateType: string
  userName: string
  nameEn: string
  headline: string
  targetCompany: string
  targetPosition: string
  education: Array<{
    name, nameEn, period, degree, description
  }>
  experiences: Array<{
    title, period, role, description, achievements: string[]
  }>
  experienceIds: string[]        // experiences 컬렉션 참조
  sections: Array<{
    title, type, content
    role: string
    contribution: number         // 기여도 %
    projectTechStack: string[]
  }>
  skills: {
    languages: string[]
    frameworks: string[]
    tools: string[]
    others: string[]
  }
  contact: {
    email, phone, linkedin, github, website
  }
  awards: Array<{ date, title, organization }>
  values: Array<{ keyword }>
  goals: Array<{ title, description }>
  interests: string[]
  checklist: {
    fileSize: boolean
    customization: boolean
    contribution: boolean
    proofread: boolean
  }
  status: string                 // "draft" | "exported"
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### jobMatches

```typescript
{
  userId: string
  jobAnalysis: {
    company, position
    requirements: {
      essential: string[]
      preferred: string[]
    }
    skills: string[]
    workConditions: { location, salary, workType }
    companyAnalysis: { coreValues, culture, recentNews }
    positionAnalysis: { mainTasks, teamStructure, growthPath }
    applicationStrategy: { coverLetterQuestions, portfolioTips, emphasis }
    portfolioRequirements: {
      required: string[]
      format: string[]
      content: string[]
      submission: string
    }
    _scrapedUrl?: string
  }
  matchResult: {
    matchResults: Array<{
      requirement: string
      type: string
      matchedExperiences: string[]
      coverageScore: number      // 0~100
    }>
    strengths: string[]
    weaknesses: string[]
    emphasisPoints: string[]
    improvementStrategy: string[]
    overallFitScore: number      // 0~100
    _experienceCount: number
  }
  coverLetter: {
    answers: Array<{
      question, answer
      wordCount: number
      usedExperiences: string[]
      highlightedValues: string[]
    }>
    tips: string[]
  } | null
  portfolioSuggestion: {
    headline: string
    recommendedExperiences: Array<{ title, reason, priority }>
    skillsToHighlight: string[]
    sections: Array<{ section, action, suggestion }>
    overallAdvice: string
  } | null
  createdAt: Timestamp
}
```

### imports (이력 로그)

```typescript
{
  userId: string
  source: "notion" | "github" | "blog" | "file" | "text" | "pdf"
  url?: string
  fileName?: string
  targetType?: "experience" | "portfolio" | "coverletter"
  importedData: {
    source, title, content, rawText
    platform?: string            // 블로그 플랫폼명
    needsManualInput?: boolean
    metadata?: object
    importedAt: string
  }
  structuredData?: object
  createdAt: Timestamp
}
```

---

## 9. 프롬프트 전략

### 9-1. 경험 분석 Split-Step (experiencePrompts.js)

단일 대형 프롬프트 대신 3단계 분할 병렬 호출로 Pro TPM 오류 회피.

```
총 API 호출: 1 + N + 1 = N+2회 (N = keyExperienceCount)
모두 Promise.all로 병렬 실행

Step 1 — 프로젝트 개요 (1회)
  입력: 경험 전체 텍스트
  출력: projectOverview + intro/overview/task/process/output/growth/competency

Step 2 — 핵심 경험 추출 (N회 병렬)
  입력: 경험 텍스트 + "i번째 핵심 경험만 추출"
  출력: 1개의 keyExperience { title, metric, chartType, situation, action, result }

Step 3 — 메타데이터 (1회)
  입력: Step1+2 요약본
  출력: keywords[], highlights[], followUpQuestions[]
```

### 9-2. 채용공고 분석 프롬프트

```
입력: 채용공고 원문 텍스트
출력 JSON 스키마:
{
  company, position
  requirements: { essential[], preferred[] }
  skills[]
  coreValues[]
  workConditions: { location, salary, workType }
  companyAnalysis: { coreValues[], culture, recentNews[] }
  positionAnalysis: { mainTasks[], teamStructure, growthPath }
  applicationStrategy: {
    coverLetterQuestions[],
    portfolioTips[],
    emphasis[]
  }
  portfolioRequirements: {
    required[], format[], content[], submission
  }
}
```

### 9-3. 자소서 생성 (병렬)

```
각 문항마다 독립적인 프롬프트 생성 → Promise.all 병렬 실행
buildSingleCoverLetterAnswerPrompt(question, experience, jobAnalysis, portfolio)
  → 답변 1개 (700~800자, STAR 구조, 기업 가치 반영)
```

---

## 10. 에러 처리 흐름

```
클라이언트 요청
     ↓
Rate Limiter 체크
  429 Too Many Requests → "잠시 후 다시 시도해주세요"
     ↓
Route Handler (try/catch)
     ↓
Service 함수 호출
     ↓
geminiClient.generateWithRetry()
  ├─ QUEUE_FULL    → 500 "서버 과부하"
  ├─ QUEUE_TIMEOUT → 504 "대기 시간 초과"
  ├─ 400 API key   → 502 "Gemini API 키 오류"
  ├─ 403 Forbidden → GitHub Models 폴백 시도
  ├─ 429 spending  → GitHub Models 폴백 시도
  └─ 모두 실패     → 502 "AI 분석 실패"
     ↓
Route catch (error)
  ├─ error.message.includes('quota') → 429
  ├─ error.message.includes('API key') → 502
  └─ 기타 → 500
     ↓
Express 글로벌 에러 핸들러
  → { error: message } JSON
```

---

## 11. 파일 업로드 & OCR 파이프라인

### 업로드 설정

| 항목 | import (문서) | upload (이미지) |
|------|--------------|----------------|
| 저장 방식 | memoryStorage (버퍼) | diskStorage (/uploads) |
| 최대 크기 | 25MB | 5MB |
| 허용 타입 | PDF, DOCX, DOC, JPG, PNG, WebP, HWP | JPG, PNG, WebP, GIF |
| MIME 검증 | ✅ | ✅ |

### OCR 파이프라인

```
파일 수신
  ↓
MIME 타입 분기
  ├─ application/pdf
  │    ↓
  │   pdf-parse 텍스트 추출
  │    ├─ 텍스트 ≥ 50자 → 완료
  │    └─ 텍스트 < 50자 (스캔본)
  │         ↓
  │       Gemini Vision OCR (inlineData)
  │
  ├─ image/* (JPG/PNG/WebP)
  │    ↓
  │   Tesseract.js OCR (kor+eng, 무료/로컬)
  │    ├─ 결과 ≥ 10자 → 완료
  │    └─ 결과 < 10자
  │         ↓
  │       Gemini Vision OCR (폴백)
  │
  ├─ DOCX (application/vnd.openxmlformats...)
  │    ↓
  │   mammoth.extractRawText()
  │    ├─ 텍스트 있음 → 완료
  │    └─ 실패
  │         ↓
  │       Gemini Vision OCR (폴백)
  │
  └─ HWP/기타 (application/octet-stream)
       ↓
      ⚠️ Gemini Vision에 바이너리 전달
         (HWP 전용 파서 미구현 — 실질적으로 지원 불가)
         실패 시 → "PDF로 변환 후 업로드 안내"
```

> **HWP 지원 현황**: `hwp.js` 등 전용 파서 미적용. Gemini Vision이 바이너리를 이해하지 못해 **사실상 지원 불가**. 사용자에게 **PDF 변환 후 업로드**를 안내하는 것이 현실적.

---

## 12. 외부 서비스 연동 지도

```
┌─────────────────────────────────────────────────────┐
│                   백엔드 서버                        │
│                                                     │
│  ┌──────────┐    ┌──────────────────────────────┐  │
│  │ Firebase │    │      Gemini API               │  │
│  │ Firestore│    │  Pro → Flash → Flash-Lite     │  │
│  │ Storage  │    │  (geminiClient 세마포어 관리)  │  │
│  └──────────┘    └──────────────────────────────┘  │
│                           │ 모두 실패                │
│  ┌──────────┐    ┌────────▼─────────────────────┐  │
│  │ Notion   │    │   GitHub Models Fallback      │  │
│  │ API v1   │    │   (gpt-4o-mini, Azure)        │  │
│  │(Export)  │    └──────────────────────────────┘  │
│  └──────────┘                                      │
│                                                     │
│  ┌──────────┐    ┌──────────────────────────────┐  │
│  │ Notion   │    │    GitHub API v3              │  │
│  │ API v3   │    │  (프로필/레포/Gist 임포트)    │  │
│  │(Import)  │    └──────────────────────────────┘  │
│  └──────────┘                                      │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │            Puppeteer (Headless Chrome)        │  │
│  │  채용공고 스크래핑 (max 2 동시)              │  │
│  │  + 블로그 스크래핑 (네이버/JS 렌더링 필요)   │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │           Tesseract.js (로컬 OCR)             │  │
│  │  이미지 텍스트 추출 (한국어+영어)             │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 13. 의존성 패키지

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "@notionhq/client": "^5.16.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^8.3.2",
    "firebase-admin": "^12.0.0",
    "helmet": "^7.1.0",
    "mammoth": "^1.12.0",
    "multer": "^1.4.5-lts.1",
    "openai": "^6.34.0",
    "pdf-parse": "^2.4.5",
    "puppeteer": "^21.6.1",
    "tesseract.js": "^7.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```

| 패키지 | 용도 |
|--------|------|
| `@google/generative-ai` | Gemini API 클라이언트 |
| `@notionhq/client` | Notion 페이지 생성 (Export용) |
| `openai` | GitHub Models (gpt-4o-mini fallback) |
| `firebase-admin` | Firestore + Storage + Auth |
| `mammoth` | Word(.docx) 텍스트 추출 |
| `pdf-parse` | PDF 텍스트 추출 |
| `tesseract.js` | 이미지 OCR (한국어+영어, 무료 로컬) |
| `puppeteer` | JS 렌더링 필요 페이지 스크래핑 |
| `multer` | 파일 업로드 미들웨어 |
| `express-rate-limit` | Rate limiting |
| `helmet` | HTTP 보안 헤더 |

---

## 14. 핵심 설계 결정 사항

### ① 세마포어 기반 글로벌 큐
단순 rate limit 로깅이 아니라 요청 발사 시점을 4.1초 간격으로 물리적으로 제어.  
여러 사용자의 동시 요청이 있어도 Gemini API에는 최대 15 RPM으로 전달됨.

### ② Split-Step 경험 분석
한 번의 거대 프롬프트 대신 3단계 분할 + Promise.all 병렬화.  
→ Pro 모델 TPM 한도 초과(503) 빈도 대폭 감소, 응답 속도 단축.

### ③ Pro 우선 + Lite 최후 안전망
품질이 중요한 경험 분석/채용공고 분석은 Pro에서 재시도를 소진 후 Lite로 폴백.  
일반 작업은 Pro 1회 실패 즉시 Lite로 이동해 응답 속도 우선.

### ④ GitHub Models 최후 폴백
403/spending cap처럼 Gemini 전체가 막힌 상황에서도 gpt-4o-mini로 서비스 지속.  
입력 6000자 제한으로 한국어 토큰 오버플로우(413) 방지.

### ⑤ 다단계 Notion 임포트
Notion의 JavaScript 렌더링 구조상 단일 fetch로는 한계가 있어 API v3 4가지 방법 순차 시도.  
모두 실패 시 사용자에게 복붙 입력 유도(needsManualInput: true).

### ⑥ Guest Mode 멀티테넌시
Firebase Auth 없이 `x-user-id` 헤더만으로 데이터 격리.  
데모/테스트 환경에서 인증 없이도 전체 기능 사용 가능.

### ⑦ Puppeteer 동시 인스턴스 제한
채용공고 스크래핑에 최대 2개 동시 Puppeteer 인스턴스만 허용 (메모리 보호).  
블로그 스크래핑에서는 Puppeteer를 최후 수단으로만 사용.
