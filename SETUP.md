# POPOL 프로젝트 실행 가이드

## 사전 요구사항

- **Node.js** v18 이상
- **npm** (Node.js 설치 시 포함)
- **Firebase 서비스 계정 키** (`backend/serviceAccountKey.json`)
- **Gemini API Key** (AI 기능 사용 시 필요)

---

## 1. 백엔드 실행

### 1-1. 디렉토리 이동

```bash
cd backend
```

### 1-2. 의존성 설치

```bash
npm install
```

### 1-3. 환경변수 설정

`backend/.env` 파일을 생성하고 아래 내용을 작성합니다:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_SERVICE_ACCOUNT_KEY=./serviceAccountKey.json
FIREBASE_PROJECT_ID=popol-cb20b
FIREBASE_STORAGE_BUCKET=popol-cb20b.firebasestorage.app
```

### 1-4. 서버 실행

```bash
# 개발 모드 (파일 변경 시 자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

백엔드 서버: **http://localhost:5000**

헬스 체크: `GET http://localhost:5000/api/health`

---

## 2. 프론트엔드 실행

### 2-1. 디렉토리 이동

```bash
cd frontend
```

### 2-2. 의존성 설치

```bash
npm install
```

### 2-3. 환경변수 설정 (선택)

`frontend/.env` 파일을 생성합니다 (기본값이 있으므로 선택사항):

```env
VITE_API_URL=http://localhost:5000/api
```

### 2-4. 개발 서버 실행

```bash
npm run dev
```

프론트엔드: **http://localhost:3000**

### 2-5. 프로덕션 빌드

```bash
npm run build
npm run preview
```

---

## 3. 동시 실행 (요약)

터미널 2개를 열어 각각 실행합니다:

```bash
# 터미널 1 - 백엔드
cd backend
npm install
npm run dev

# 터미널 2 - 프론트엔드
cd frontend
npm install
npm run dev
```

| 서비스 | URL | 포트 |
|--------|-----|------|
| 프론트엔드 | http://localhost:3000 | 3000 |
| 백엔드 API | http://localhost:5000 | 5000 |

> **참고:** 프론트엔드의 Vite 프록시 설정으로 `/api/*` 요청은 자동으로 백엔드(포트 5000)로 전달됩니다.

---

## 4. 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 18, Vite, TailwindCSS, Zustand |
| 백엔드 | Node.js, Express |
| 데이터베이스 | Firebase Firestore |
| 파일 저장 | Firebase Storage |
| 인증 | Firebase Auth (Google OAuth) |
| AI | Google Gemini API |
