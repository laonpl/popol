YAML
name: popol-system-guide
description: "popol 서비스의 기술적 보완점, 보안 가이드, 수익 구조 분석 및 운영 표준을 제공합니다. Use for: popol 서비스의 백엔드 로직 개선, 보안 취약점 해결, 토큰 사용량 기반 수익 모델 계산, 시스템 고도화 로드맵 작성."
POPOL 시스템 가이드 (popol-system-guide)
이 스킬은 popol 서비스의 기술적 부채를 해결하고, 보안을 강화하며, 수익 구조를 최적화하기 위한 전문 지식과 워크플로우를 제공합니다.
1. 주요 기능 (Key Capabilities)
보안 강화 (Security Hardening): IDOR 취약점 해결 및 Firebase Admin SDK 기반 인증 표준 가이드 제공.
데이터 최적화 (Data Optimization): Base64 이미지 저장 방식 개선 및 AI 호출 안정성 확보 방안 제시.
수익 모델 분석 (Economic Analysis): 토큰 사용량 기반의 건당 비용 계산 및 수익성 극대화 전략 제공.
시스템 고도화 (System Roadmap): 프로토타입에서 상용 서비스로 전환하기 위한 기술 로드맵 제시.
2. 사용 방법 (Usage Instructions)
2.1 보안 및 아키텍처 개선
/home/ubuntu/skills/popol-system-guide/references/security_architecture.md를 참조하여 백엔드 인증 및 데이터 처리 로직을 개선하십시오.
핵심 원칙: 모든 요청은 서버 측에서 검증되어야 하며, 사용자 데이터는 소유권 확인 후 제공되어야 합니다.
2.2 수익 구조 및 비용 관리
/home/ubuntu/skills/popol-system-guide/references/economics_token_usage.md를 참조하여 AI 비용을 추산하고 수익 모델을 설계하십시오.
비용 절감: 단순 작업은 gemini-2.5-flash-lite 모델을 활용하여 비용을 최소화하십시오.
3. 기술적 보완점 요약 (Technical Debt Summary)
구분
현황 및 문제점
개선 방향
인증
x-user-id 헤더 의존 (IDOR 위험)
Firebase Admin SDK 기반 토큰 검증
데이터
Firestore에 Base64 이미지 직접 저장
Firebase Storage 활용 및 URL 저장
AI 로직
4.1초 간격의 엄격한 직렬화 호출
사용자별 Rate Limit 및 모델 믹스 적용
수익성
건당 1만원 과금 (비용 대비 고수익)
구독형 모델 도입 및 B2B 확장 고려
4. 관련 리소스 (Bundled Resources)
References:
security_architecture.md: 보안 및 시스템 구조 개선 상세 가이드.
economics_token_usage.md: 토큰 사용량 분석 및 수익 모델 계산 가이드.
이 가이드는 popol 서비스의 지속 가능한 성장을 위해 정기적으로 업데이트되어야 합니다.

#!/usr/bin/env python3
"""
Example helper script for popol-system-guide

This is a placeholder script that can be executed directly.
Replace with actual implementation or delete if not needed.

Example real scripts from other skills:
- pdf/scripts/fill_fillable_fields.py - Fills PDF form fields
- pdf/scripts/convert_pdf_to_images.py - Converts PDF pages to images
"""

def main():
    print("This is an example script for popol-system-guide")
    # TODO: Add actual script logic here
    # This could be data processing, file conversion, API calls, etc.

if __name__ == "__main__":
    main()


Reference Documentation for Popol System Guide
This is a placeholder for detailed reference documentation.
Replace with actual reference content or delete if not needed.
Example real reference docs from other skills:
product-management/references/communication.md - Comprehensive guide for status updates
product-management/references/context_building.md - Deep-dive on gathering context
bigquery/references/ - API references and query examples
When Reference Docs Are Useful
Reference docs are ideal for:
Comprehensive API documentation
Detailed workflow guides
Complex multi-step processes
Information too lengthy for main SKILL.md
Content that's only needed for specific use cases
Structure Suggestions
API Reference Example
Overview
Authentication
Endpoints with examples
Error codes
Rate limits
Workflow Guide Example
Prerequisites
Step-by-step instructions
Common patterns
Troubleshooting
Best practices

POPOL 보안 및 아키텍처 개선 가이드
이 문서는 popol 서비스의 기술적 부채를 해결하고 시스템의 안정성을 높이기 위한 핵심 지침을 담고 있습니다.
1. 보안 강화 (Security Hardening)
1.1 IDOR(Insecure Direct Object Reference) 방지
문제: x-user-id 헤더에만 의존하여 타인의 데이터를 조회할 수 있는 취약점.
해결:
모든 API 요청 시 Authorization: Bearer <ID_TOKEN>을 필수로 요구.
Firebase Admin SDK를 사용하여 서버 측에서 토큰 검증.
Firestore 쿼리 시 반드시 .where('userId', '==', req.user.uid) 조건을 포함.
1.2 인증 미들웨어 표준
JavaScript
// middleware/auth.js
export async function authMiddleware(req, res, next) {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) return res.status(401).send('Unauthorized');
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (e) {
    res.status(403).send('Forbidden');
  }
}
2. 데이터 처리 최적화 (Data Optimization)
2.1 이미지 저장 방식 변경
현황: Base64 문자열로 Firestore에 직접 저장 (문서당 1MB 제한 위험).
개선:
클라이언트에서 Firebase Storage로 직접 업로드 후 다운로드 URL만 Firestore에 저장.
또는 서버 측에서 multer를 이용해 S3/Storage로 중계 업로드.
2.2 AI 호출 안정성 (Rate Limiting)
현황: 4.1초 간격의 엄격한 직렬화로 인한 병목.
개선:
사용자별 Rate Limit 적용 (예: 분당 5회 분석).
중요도가 낮은 작업(메타데이터 추출 등)은 gemini-2.5-flash-lite 모델로 우선 처리.
3. 에러 핸들링 및 폴백 (Error Handling & Fallback)
AI 모델 폴백: Pro 모델 실패 시 즉시 Lite 모델로 전환하는 로직을 geminiService 수준에서 공통화.
타임아웃 관리: AI 분석 API의 타임아웃을 최소 60초 이상으로 설정하고, 클라이언트에는 낙관적 UI(Optimistic UI) 또는 진행 상태바 제공.

# Example Template File

This placeholder represents where template files would be stored.
Replace with actual template files (templates, images, fonts, etc.) or delete if not needed.

Template files are NOT intended to be loaded into context, but rather used within
the output Manus produces.

Example template files from other skills:
- Brand guidelines: logo.png, slides_template.pptx
- Frontend builder: hello-world/ directory with HTML/React boilerplate
- Typography: custom-font.ttf, font-family.woff2
- Data: sample_data.csv, test_dataset.json

## Common Template Types

- Templates: .pptx, .docx, boilerplate directories
- Images: .png, .jpg, .svg, .gif
- Fonts: .ttf, .otf, .woff, .woff2
- Boilerplate code: Project directories, starter files
- Icons: .ico, .svg
- Data files: .csv, .json, .xml, .yaml

Note: This is a text placeholder. Actual templates can be any file type.
