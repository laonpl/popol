포트폴리오 프로젝트 전면 리팩토링 및 최적화 프롬프트
당신은 프론트엔드/백엔드 아키텍처 최적화 및 리팩토링 전문 AI입니다. 아래 제공된 코드베이스 분석 결과를 바탕으로, 프로젝트의 중복 코드를 완벽히 제거하고 컴포넌트 간 호환성 및 유지보수성을 극대화하는 리팩토링 작업을 수행해 주세요.

⚠️ 현재 시스템 아키텍처 분석 및 주요 문제점
1. 프론트엔드: 초거대 Monolith 파일 및 로직 집중 현상
분석결과: NotionPortfolioEditor.jsx (약 375KB), PdfPortfolioExport.jsx (약 142KB), generatePptx.js (약 112KB) 등 프론트엔드 핵심 파일들의 코드가 비정상적으로 길고 방대합니다.
발생 문제(Smell): 렌더링 로직, 로컬 상태 관리, API 호출(사이드 이펙트), 그리고 모달이나 UI 요소 같은 수십 개의 서브 컴포넌트(InlineText, ExpDetailModal, Slide, SectionLabel 등)가 파일 분리 없이 하나에 뭉쳐 있습니다.
2. 하드코딩된 상수 설정 및 유틸리티 함수의 심각한 중복
분석결과: THEMES, SECTION_LABELS, TEMPLATE_SECTION_MAP 같은 핵심 포트폴리오 메타데이터가 NotionPortfolioEditor, PdfPortfolioExport, generatePptx.js 에 각각 중복으로 복사되어 있습니다.
발생 문제(Smell): 특정 테마의 색상이나 라벨이 변경될 경우 세 파일을 모두 찾아 수정해야 하며, 누락 시 컴포넌트 간 호환성(데이터 불일치) 오류가 발생합니다. stripMd, toBullets, shorten 같은 텍스트 가공 유틸리티도 곳곳에 중복 선언되어 메모리와 컨텍스트를 낭비하고 있습니다.
3. 백엔드: 서비스 계층의 프롬프트 및 비즈니스 로직 혼재
분석결과: geminiService.js (약 23KB) 등의 파일 내에 AI Retry/Fallback 네트워크 제어 로직, Firestore 데이터 파싱 로직, 그리고 아주 긴 텍스트 프롬프트 템플릿 로직이 단일 파일에 들어있습니다.
발생 문제(Smell): 프롬프트를 조금만 수정하려 해도 핵심 서비스 로직 전체를 건드려야 하므로 단일 책임 원칙(SRP)이 심각하게 훼손되고 있습니다.
🛠 리팩토링 수행 지침 (Action Plan)
제시된 문제를 해결하기 위해, 반드시 다음의 [4단계 전략]에 맞춰 코드를 분리하고 개편해 주세요. 각 단계를 진행할 때는 기존 기능(특히 AI 생성 및 PDF/PPT 다운로드 등)이 훼손되지 않도록 주의해야 합니다.

[Phase 1] 공통 상수 및 유틸리티 저장소 분리 (Single Source of Truth)
상수 분리: frontend/src/constants/ 디렉토리를 신설하고, 중복으로 선언된 THEMES(테마 색상/디자인 스펙), SECTION_LABELS, TEMPLATE_SECTION_MAP 등을 portfolioConstants.js 로 추출하여 통합하세요.
함수 분리: frontend/src/utils/ 디렉토리를 생성하고, 텍스트 파싱을 담당하는 stripMd, toBullets, shorten, extractFields 등의 순수 함수를 textUtils.js로 추출한 뒤 각 컴포넌트에서 import 방식으로 사용하도록 수정하세요.
[Phase 2] 프론트엔드 서브 컴포넌트 분할 (Component Extraction)
에디터 컴포넌트 분리: NotionPortfolioEditor.jsx 에 하드코딩된 모든 인라인 모달(ExpDetailModal, SkillAddInput), 입력 인풋(InlineText) 서브 뷰들을 frontend/src/components/editor/ 로 모듈화해 이동시키세요.
프리젠테이션 컴포넌트 분리: PdfPortfolioExport.jsx 의 Slide, SituationDefaultSlide, ProjectLabel 같은 PPT 형식의 UI 블록들을 frontend/src/components/ppt/ (또는 slides/) 로 분리하세요. 분리된 컴포넌트들은 PDF 렌더링 뷰와 generatePptx.js 등 다른 로직에서 공통으로 재사용되어야 합니다.
[Phase 3] 스마트/덤 컴포넌트 패턴 적용 및 사이드 이펙트 처리
뷰 컴포넌트 내부에 삽입된 직접적인 API 호출(예: handleTailor를 통한 api.post 호출)을 커스텀 훅(src/hooks/useAITailoring.js 등)이나 Zustand 스토어로 이관하세요.
UI 컴포넌트는 순수하게 Props 중심의 렌더링에만 집중하도록 '설계 복잡도'를 낮추세요.
[Phase 4] 백엔드 프롬프트 및 인프라 분리 (Backend Refactoring)
geminiService.js 내에 정의된 길고 복잡한 프롬프트 문자열들을 backend/src/prompts/ 또는 backend/src/config/prompts.js로 완전히 분리하세요.
API 연동을 담당하는 Core 네트워크 로직(Timeout, Retry, Fallback)과 비즈니스 로직(경험 분석, 자소서 초안 생성 등)을 분리하여 서비스 파일들의 부피를 줄이세요.
[프롬프트 실행 시 주의사항]

모든 리팩토링은 한 번에 모든 것을 부수는 빅뱅 방식이 아닌, "유틸리티/상수 분리 → 서브 컴포넌트 추출 → 상태 관리 추출" 의 점진적 단계로 진행합니다.
코드를 교체할 때는 반드시 추출된 대상의 명확한 Import 경로가 파일 상단에 지정되도록 누락 없이 연결해 주세요.