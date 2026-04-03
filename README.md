# POPOL - 스마트 포트폴리오 & 경험 정리 플랫폼

## 📁 프로젝트 구조
```
popol/
├── frontend/                  # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── config/firebase.js     # Firebase 클라이언트 설정
│   │   ├── stores/                # Zustand 상태 관리
│   │   │   ├── authStore.js       # 인증 (Google OAuth)
│   │   │   ├── experienceStore.js # 경험 CRUD + AI 분석
│   │   │   ├── portfolioStore.js  # 포트폴리오 + 체크리스트
│   │   │   └── coverLetterStore.js# 자소서 + AI 초안
│   │   ├── pages/
│   │   │   ├── experience/        # 경험 정리 섹션
│   │   │   ├── portfolio/         # 포트폴리오 섹션
│   │   │   └── coverletter/       # 자기소개서 섹션
│   │   ├── components/            # 공통 UI 컴포넌트
│   │   └── services/api.js        # Axios API 클라이언트
│   └── ...
├── backend/                   # Node.js + Express
│   ├── src/
│   │   ├── index.js               # Express 서버 엔트리
│   │   ├── config/firebase.js     # Firebase Admin SDK
│   │   ├── middleware/auth.js     # JWT 토큰 인증
│   │   ├── routes/
│   │   │   ├── experience.js      # 경험 분석 API
│   │   │   ├── portfolio.js       # 포트폴리오 검증/Export
│   │   │   ├── coverletter.js     # 자소서 AI 생성
│   │   │   └── export.js          # 멀티포맷 Export
│   │   └── services/
│   │       └── geminiService.js   # Gemini AI 통합
│   └── ...
└── README.md
```

---

## 🏗️ 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ 경험정리  │  │포트폴리오│  │ 자소서   │               │
│  │ (STAR,5F │  │ (에디터  │  │ (AI초안  │               │
│  │  PMI,KPT │  │  체크리스│  │  경험연동│               │
│  │  4L)     │  │  트,Export│ │  글자수) │               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │              │              │                     │
│  ┌────┴──────────────┴──────────────┴────┐               │
│  │         Zustand Store (상태관리)       │               │
│  │  authStore | experienceStore |         │               │
│  │  portfolioStore | coverLetterStore     │               │
│  └────────────────┬──────────────────────┘               │
│                   │                                       │
│  ┌────────────────┴───────────────────────┐              │
│  │     Firebase Client SDK (직접 접근)     │              │
│  │  Firestore CRUD | Auth | Storage       │              │
│  └────────────────┬───────────────────────┘              │
└───────────────────┼──────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
   ┌────┴────┐ ┌───┴────┐ ┌───┴──────┐
   │Firebase │ │Firebase│ │Firebase  │
   │  Auth   │ │Firestore│ │Storage  │
   └─────────┘ └────────┘ └──────────┘
                    │
        ┌───────────┘
        │ (AI/검증 등 무거운 로직)
┌───────┴──────────────────────────────────────────────────┐
│                   Backend (Express)                       │
│  ┌──────────────────────────────────────────┐            │
│  │  Auth Middleware (Firebase ID Token 검증)  │            │
│  └──────────────┬───────────────────────────┘            │
│                 │                                         │
│  ┌──────────────┴───────────────────────────┐            │
│  │              Routes                       │            │
│  │  /experience/analyze   → Gemini AI 분석   │            │
│  │  /portfolio/validate   → 체크리스트 검증   │            │
│  │  /portfolio/export     → 멀티포맷 변환     │            │
│  │  /coverletter/generate → AI 자소서 초안    │            │
│  └──────────────┬───────────────────────────┘            │
│                 │                                         │
│  ┌──────────────┴───────────────────────────┐            │
│  │         Gemini AI Service                 │            │
│  │  경험 분석 | 포트폴리오 검수 | 자소서 생성  │            │
│  └───────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────┘
```

---

## 🗄️ Firestore DB 스키마 (ERD)

### Users (자동 생성 via Firebase Auth)
```
users/{uid}
├── email: string
├── displayName: string
├── photoURL: string
└── createdAt: timestamp
```

### Experiences (경험 마스터 DB)
```
experiences/{experienceId}
├── userId: string (→ users)
├── title: string
├── framework: "STAR" | "5F" | "PMI" | "KPT" | "4L"
├── content: {
│   ├── situation?: string    (STAR)
│   ├── task?: string
│   ├── action?: string
│   ├── result?: string
│   ├── fact?: string         (5F)
│   ├── feeling?: string
│   ├── finding?: string
│   ├── future?: string
│   ├── feedback?: string
│   ├── plus?: string         (PMI)
│   ├── minus?: string
│   └── interesting?: string
│   }
├── keywords: string[]           # AI 추출 역량 키워드
├── aiAnalysis: {
│   ├── competencyKeywords: string[]
│   ├── highlights: [{field, text, type}]
│   ├── suggestedQuestions: string[]
│   ├── hrInsight: string
│   └── summary: string
│   }
├── createdAt: timestamp
└── updatedAt: timestamp
```

### Portfolios
```
portfolios/{portfolioId}
├── userId: string (→ users)
├── title: string
├── userName: string
├── targetCompany: string
├── targetPosition: string
├── sections: [{
│   ├── type: "intro"|"experience"|"skills"|"education"|"awards"|"custom"
│   ├── title: string
│   ├── content: string
│   ├── experienceId?: string (→ experiences)
│   ├── role?: string
│   ├── contribution?: number
│   └── order: number
│   }]
├── experienceIds: string[]
├── status: "draft"|"review"|"exported"
├── exportFormat: "PDF"|"Notion"|"GitHub"
├── checklist: {
│   ├── fileSize: boolean
│   ├── format: boolean
│   ├── naming: boolean
│   ├── customization: boolean
│   ├── contribution: boolean
│   └── proofread: boolean
│   }
├── createdAt: timestamp
└── updatedAt: timestamp
```

### CoverLetters (자기소개서)
```
coverLetters/{coverLetterId}
├── userId: string (→ users)
├── title: string
├── targetCompany: string
├── targetPosition: string
├── questions: [{
│   ├── question: string
│   ├── answer: string
│   ├── linkedExperienceIds: string[] (→ experiences)
│   ├── wordCount: number
│   └── maxWordCount: number
│   }]
├── experienceIds: string[]
├── status: "draft"|"review"|"final"
├── createdAt: timestamp
└── updatedAt: timestamp
```

### 컬렉션 관계도
```
Users ─1:N─ Experiences
Users ─1:N─ Portfolios
Users ─1:N─ CoverLetters
Experiences ──N:M── Portfolios.sections (experienceId로 연결)
Experiences ──N:M── CoverLetters.questions (linkedExperienceIds로 연결)
```

---

## ✅ Feature 4: 체크리스트 판별 시스템 설계

### Export 흐름
```
사용자 'Export' 클릭
        │
        ▼
┌─ ChecklistModal 표시 ─┐
│                        │
│  "검증 시작" 클릭       │
│        │                │
│        ▼                │
│  ┌─ 프론트엔드 검증 ─┐  │
│  │ ① 네이밍 룰 검증   │  │  → 정규식: /^[가-힣a-zA-Z]+_포트폴리오$/
│  │ ② 포맷 검증        │  │  → ['PDF','Notion','GitHub'] 포함 확인
│  └────────┬───────────┘  │
│           │               │
│           ▼               │
│  ┌─ 백엔드 API 호출 ──┐  │  POST /api/portfolio/validate
│  │ ③ 파일 용량 체크    │  │  → Buffer.byteLength() < 20MB
│  │ ④ AI 맞춤형 검토   │  │  → Gemini: 기업 매칭도 검사
│  │ ⑤ 기여도 명시 검수  │  │  → Gemini: role/contribution 존재 확인
│  │ ⑥ 오타/비문 검수   │  │  → Gemini: 맞춤법/문법 검사
│  └────────┬───────────┘  │
│           │               │
│           ▼               │
│  ┌─ 결과 집계 ─────────┐ │
│  │ 6개 항목 전부 passed? │ │
│  └──┬──────────┬───────┘ │
│     │          │          │
│   전부통과   실패있음     │
│     │          │          │
│     ▼          ▼          │
│  Export     실패 항목     │
│  버튼 활성  표시 및      │
│             수정 안내     │
└───────────────────────────┘
```

### 검증 로직 분배

| 항목 | 처리 위치 | 기술적 접근 |
|------|-----------|------------|
| ① 네이밍 룰 | **프론트엔드** | `RegExp.test()` 즉시 검증 |
| ② 포맷 검증 | **프론트엔드** | 배열 `.includes()` 매칭 |
| ③ 파일 용량 | **백엔드** | `Buffer.byteLength()` 계산 |
| ④ 맞춤형 검토 | **백엔드** (Gemini) | AI가 기업/직무 키워드 매칭 분석 |
| ⑤ 기여도 명시 | **백엔드** (Gemini) | AI가 섹션별 role/contribution 존재 확인 |
| ⑥ 오타/비문 | **백엔드** (Gemini) | AI 맞춤법/문법 검사 |

---

## 🚀 실행 방법

### Frontend
```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

### Backend
```bash
cd backend
npm install
npm run dev      # http://localhost:5000
```

### 환경 변수
- `frontend/.env`: API URL
- `backend/.env`: Gemini API Key, Firebase 설정

---

## 🔗 3대 섹션 연결 구조

```
경험 정리 ──────────────────────── 포트폴리오
  │  STAR/5F/PMI/KPT/4L            │  경험 → 섹션 연결
  │  AI 역량 키워드 추출             │  체크리스트 6단계
  │  핵심 문장 하이라이팅            │  Export (PDF/Notion/GitHub)
  │                                  │
  └──── 경험 DB (Firestore) ────────┘
                │
                │ linkedExperienceIds
                ▼
          자기소개서
            │  문항별 경험 연결
            │  AI 초안 생성
            │  글자 수 관리
```
