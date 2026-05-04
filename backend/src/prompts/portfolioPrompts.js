/**
 * portfolioPrompts.js
 * 자기소개서 초안 / 포트폴리오 검수 / 직무 요건 매칭 프롬프트 빌더.
 */

/** 자기소개서 문항 답변 초안을 생성하는 프롬프트. */
export function buildCoverLetterDraftPrompt(question, experienceText, targetCompany, targetPosition) {
  return `자소서 전문 컨설턴트입니다. 아래 정보로 자기소개서 답변 초안을 작성하세요.

지원: ${targetCompany || '미정'} / ${targetPosition || '미정'}
문항: ${question}
활용 경험: ${experienceText ? experienceText.substring(0, 2000) : '없음'}

작성 기준: CARL 구조(배경-행동-결과-배운점), 구체적 수치 포함, 500자 내외, 자연스러운 한국어.
답변만 작성 (추가 설명 없이):`;
}

/** 포트폴리오 전체 검수(맞춤형/기여도/오타) 프롬프트. */
export function buildValidatePortfolioPrompt(portfolioData, sectionsText) {
  return `포트폴리오 검수 전문가입니다.

제목: ${portfolioData.title} | 기업: ${portfolioData.targetCompany || '미정'} | 직무: ${portfolioData.targetPosition || '미정'}

섹션 내용:
${sectionsText.substring(0, 3000)}

검수 항목:
1. 기업/직무 맞춤형 (프로젝트 순서·강조 포인트 적절성)
2. 기여도 명시 (팀 프로젝트 역할·기여도% 기재 여부)
3. 오타/비문

반드시 아래 JSON으로만 응답:
{
  "customization": { "passed": true, "message": "..." },
  "contribution": { "passed": true, "message": "..." },
  "proofread": { "passed": true, "message": "...", "issues": [] }
}`;
}

/** 섹션별 직무 요건 매칭 분석 프롬프트. */
export function buildMatchSectionsPrompt(targetCompany, targetPosition, sectionsText) {
  return `포트폴리오 컨설턴트입니다.
"${targetCompany}" "${targetPosition}" 직무에 아래 섹션들이 부합하는지 분석하세요.

평가: matched=true(직무 강점 명확), matched=false(관련성 낮음/내용 부족)

섹션:
${sectionsText.substring(0, 3000)}

JSON 배열로만 응답:
[{ "index": 0, "matched": true, "relevance": "high", "reason": "한 문장" }]`;
}

/**
 * Stage 1: 링크형 포트폴리오 전체(모든 섹션 + 경험·프로젝트)에서
 * "합격자 PPT 콘텐츠 팩"을 추출. 슬라이드 수에 맞춰 슬롯을 미리 계획.
 * 출력: 표지/스킬/경험별 STAR/성과/마무리 + 슬라이드 슬롯 시퀀스
 */
export function buildPortfolioDistillPrompt({ portfolioText, slideCount }) {
  return `당신은 네카라쿠배 합격자 포트폴리오를 N년간 첨삭한 시니어 면접관입니다.
사용자의 [Link Portfolio Raw] 데이터에서 "진짜 합격자 PPT 포트폴리오"에 들어갈 핵심 포인트만 추출·정제하세요.
PPT 디자인은 별개 단계에서 적용되므로, 이 단계에서는 오직 콘텐츠의 질과 구조에만 집중합니다.

[추출 원칙]
1. 모든 섹션을 빠짐없이 훑되, 발표 가치가 낮은 사족(중복 자기소개, 일반론)은 과감히 버린다.
2. 각 프로젝트/경험은 STAR 구조(상황·과제·행동·결과)로 한 번 요약.
3. 정량 수치(%·시간·인원·매출 등)와 사용 기술스택은 반드시 보존. 없는 수치는 만들지 않는다.
4. 합격자 화법: 개조식("~함", "~적용해 ~달성"), 능동·구체·결과 중심. 마크다운 금지.
5. 섹션이 비었거나 약한 항목은 빈 배열로 둔다 (억지로 채우지 않음).
6. 한 줄 길이 ≤ 38자 권장.

[summary 필수 필드 — 절대 비워두지 말 것]
- summary.name: 입력에 이름이 명시되어 있으면 그대로. 없으면 "이름 미상" (절대 스킬/문장으로 채우지 말 것).
- summary.headline: 본인을 한 문장으로 정의 (지원 직무 + 핵심 가치). 입력에 없으면 role_target 으로 만들어 채움.
- summary.role_target: 지원 직무. 없으면 "직무 미정".
- summary.tagline: 키워드 3~5개 ' · ' 연결. 스킬과 다름. 키워드가 부족하면 빈 문자열.
- summary.contact_lines: 이메일/전화/링크. 없으면 빈 배열.
- summary 의 어떤 필드도 다른 필드의 값과 같으면 안 된다 (headline ≠ tagline).

[슬라이드 슬롯 계획 — 강제]
총 슬라이드 수: ${slideCount}장. slide_slots 배열은 정확히 ${slideCount}개여야 한다.
- slideIndex=0 → intent="profile" (변경 불가)
- slideIndex=${slideCount - 1} → intent="contact" (변경 불가)
- 그 사이는 우선순위로 채우기: skills → 각 프로젝트의 project → (가장 임팩트 큰 1개에 한해) process → result → education
- 프로젝트가 많으면 가장 임팩트 큰 1~2개만 process/result 별도 슬롯, 나머지는 project 슬롯 안에 압축.
- 슬롯 수가 콘텐츠보다 많으면 남는 슬롯은 intent="project" 로 두고 focus="projects[i]" 를 순환.
- focus 는 반드시 contentPack 내 실제 키 또는 인덱스("projects[0]" 형태)를 가리켜야 한다.

[Link Portfolio Raw]
${portfolioText.substring(0, 9000)}

반드시 아래 JSON 객체만 응답 (다른 설명 금지):
{
  "summary": {
    "headline": "한 줄로 요약된 본인 핵심 가치 (≤30자)",
    "name": "...",
    "role_target": "지원 직무 (≤24자)",
    "tagline": "키워드 3~5개를 ' · '로 연결",
    "contact_lines": ["email ...", "github ..."]
  },
  "skills_groups": [
    { "label": "Languages", "items": ["..."] },
    { "label": "Frameworks", "items": ["..."] }
  ],
  "projects": [
    {
      "title": "프로젝트명 (≤28자)",
      "role_period": "역할 · 기간",
      "tech_stack": ["React", "Node.js"],
      "situation": "...",
      "task": "...",
      "action": ["행동 1", "행동 2"],
      "result": ["정량 결과 1", "정량 결과 2"],
      "learning": "한 줄 (≤32자)"
    }
  ],
  "education": [{ "title": "...", "detail": "..." }],
  "awards": [{ "title": "...", "detail": "..." }],
  "values_keywords": ["..."],
  "slide_slots": [
    { "slideIndex": 0, "intent": "profile", "focus": "cover" },
    { "slideIndex": 1, "intent": "skills", "focus": "skills_overview" },
    { "slideIndex": 2, "intent": "project", "focus": "projects[0]" },
    { "slideIndex": 3, "intent": "result", "focus": "projects[0].result" }
  ]
}`;
}

/** Stage 2: 디자인-온리 레이아웃 지도 + 콘텐츠 팩 → shape별 텍스트/폰트 크기 매핑. */
export function buildDirectPptxTemplateMappingPrompt({ templateTitle, slides, portfolioText, contentPack }) {
  const slots = Array.isArray(contentPack?.slide_slots) ? contentPack.slide_slots : [];
  const slotLines = slots
    .map(s => `  - slide ${s.slideIndex}: intent="${s.intent}" focus="${s.focus}"`)
    .join('\n') || '  (없음 — 슬라이드 0=profile, 마지막=contact, 중간=skills/projects 순서로 자동 배정)';

  return `당신은 합격자 PPT 포트폴리오의 레이아웃 디렉터입니다.
PPTX 템플릿은 **오직 디자인(배경·도형·색상·타이포·배치)** 만 참고합니다.
템플릿의 원본 텍스트는 입력에 포함되어 있지도 않으며, 추측하지도 마세요.

──────────────────────────────────────────────
[강제 규칙 — 위반 시 결과를 폐기합니다]
──────────────────────────────────────────────
A) 슬라이드 의도(intent)는 아래 [Slide Slots] 를 그대로 따른다. 절대 변경 금지.
B) intent 와 shape 의 role_hint 가 결정한 "콘텐츠 카테고리" 만 그 박스에 넣는다.
   아래 [Shape Recipe Table] 을 그대로 적용. 추측 금지.
C) **Fit to Box (필수):** 각 shape의 char_budget 을 절대 초과 금지.
   - new_text 의 글자수 ≤ char_budget.
   - 초과가 불가피하면 char_budget 에 맞춰 텍스트를 더 줄이거나,
     font_size_pt 를 original_font_size_pt 보다 작게 권장 (최소 10pt).
D) 같은 슬라이드 내 동일 문구 중복 배치 금지.
E) 없는 사실/없는 수치/없는 기술스택은 만들지 않는다 (Content Pack 에 있는 값만 사용).
F) 마크다운/이모지/괄호 장식 금지. 줄바꿈은 \\n.

──────────────────────────────────────────────
[Shape Recipe Table — intent × role_hint → 콘텐츠 카테고리]
──────────────────────────────────────────────
intent="profile" (표지)
  · Main Title    → \`summary.headline\`  (사용자의 핵심 가치 한 줄). 비어 있으면 \`summary.role_target\`. 절대 skills/tagline 사용 금지.
  · Subtitle      → \`summary.role_target\` 또는 \`summary.tagline\`
  · Body/Subtext  → \`summary.headline\` 의 보충 1~2줄 또는 \`summary.contact_lines\` 1~2개
  · Tag/Metric    → \`values_keywords\` 중 한 개 (≤10자)
  · Table Cell    → \`summary.contact_lines\` 1개씩 (이메일/연락처/링크)
  · 슬라이드 어디에든 \`summary.name\` 이 들어갈 작은 박스 1개는 반드시 포함 (이름이 어디에도 안 들어가면 안 됨)

intent="skills" (역량)
  · Main Title    → "핵심 역량" 또는 \`summary.role_target\` + " 핵심 스킬"
  · Body          → \`skills_groups\` 를 라벨별로 줄로 나열 (각 줄 = "Languages: A · B · C")
  · Tag/Metric    → \`values_keywords\` 중 1개
  · Table Cell    → skills_groups 의 항목 1개씩

intent="project" (프로젝트 개요)
  · Main Title    → \`projects[focus].title\`
  · Subtitle      → \`projects[focus].role_period\`
  · Body          → STAR 압축: \`situation\` + \`task\` + \`action[0..2]\` 개조식 2~4줄
  · Tag/Metric    → \`projects[focus].tech_stack\` 중 임팩트 큰 1개
  · Subtext       → \`projects[focus].learning\`
  · Table Cell    → tech_stack 항목 1개씩

intent="process" (문제 해결 과정)
  · Main Title    → \`projects[focus].title\` + " — 문제 해결"
  · Body          → \`task\` + \`action[*]\` 개조식 3~4줄
  · Subtext       → \`learning\`

intent="result" (성과)
  · Main Title    → \`projects[focus].title\` + " — 성과"
  · Body          → \`projects[focus].result[*]\` 정량 결과 개조식 2~4줄
  · Tag/Metric    → result 중 핵심 수치 (예: "P95 -42%")
  · Subtext       → \`learning\`

intent="education" (학력/수상)
  · Main Title    → "Education & Awards"
  · Body          → \`education[*].title\` + " · " + \`detail\` 줄로 나열
  · Subtext       → \`awards[*].title\` 한 줄씩

intent="contact" (마무리/연락)
  · Main Title    → "감사합니다" 또는 \`summary.headline\`
  · Subtitle      → \`summary.name\` + " · " + \`summary.role_target\`
  · Body/Subtext  → \`summary.contact_lines\` 줄바꿈
  · Tag/Metric    → 키워드 1개

──────────────────────────────────────────────

템플릿명: ${templateTitle || '업로드 PPTX'}

[Slide Slots — 각 슬라이드의 intent/focus 강제]
${slotLines}

[Template Layout Map — 디자인 지오메트리만]
${JSON.stringify(slides, null, 2).substring(0, 7000)}

[Distilled Content Pack — 위 Recipe 가 참조하는 데이터]
${JSON.stringify(contentPack || {}, null, 2).substring(0, 6000)}

반드시 아래 JSON 객체만 응답 (다른 설명/마크다운 금지):
{
  "mappings": [
    {
      "slideIndex": 0,
      "intent": "profile",
      "shapes": [
        { "shape_id": 1, "inferred_role": "Main Title", "new_text": "데이터로 사용자 가치를 증명하는 PM", "font_size_pt": 36 },
        { "shape_id": 2, "inferred_role": "Subtitle",   "new_text": "Product · Growth · 4년차" },
        { "shape_id": 3, "inferred_role": "Subtext",    "new_text": "김유신\\ngithub.com/foo\\nfoo@example.com" }
      ]
    }
  ]
}`;
}

/** 포트폴리오 섹션 1개를 기업 맞춤형으로 재작성하는 프롬프트 (병렬 처리용). */
export function buildSingleSectionTailorPrompt(section, index, jobAnalysis) {
  return `취업 전문 컨설턴트입니다. 포트폴리오 섹션 1개를 기업 맞춤형으로 재작성하세요.
사실을 유지하되 기업이 원하는 역량·가치관 강조 방향으로 표현만 조정. 내용 없는 섹션은 그대로 반환.
JSON 값 안에 마크다운 기호(**, ##, *, -) 사용 금지.

기업: ${jobAnalysis.company || ''} | 직무: ${jobAnalysis.position || ''}
스킬: ${(jobAnalysis.skills || []).join(', ')} | 인재상: ${(jobAnalysis.coreValues || []).join(', ')}
필수요건: ${(jobAnalysis.requirements?.essential || []).slice(0, 4).join(', ')}

섹션 정보:
타입: ${section.type || ''} | 제목: ${section.title || ''}
내용: ${(section.content || '(내용 없음)').substring(0, 600)}

반드시 아래 JSON으로만 응답:
{ "index": ${index}, "tailoredContent": "재작성된 내용", "changeReason": "변경 이유 한 줄", "changed": true }`;
}

/** 자소서 문항 1개에 대한 답변 초안을 생성하는 프롬프트 (병렬 처리용). */
export function buildSingleCoverLetterAnswerPrompt(question, maxLength, expText, jobAnalysis) {
  return `자소서 전문 컨설턴트입니다. 자기소개서 문항 1개에 대한 답변을 작성하세요.

기업: ${jobAnalysis.company || '미정'} | 직무: ${jobAnalysis.position || '미정'}
인재상: ${(jobAnalysis.coreValues || []).join(', ')} | 스킬: ${(jobAnalysis.skills || []).slice(0, 6).join(', ')}

문항: ${question}
글자 수 제한: ${maxLength || '제한 없음'}자 내외

활용 경험:
${(expText || '등록된 경험 없음').substring(0, 2000)}

작성 기준: 인재상 맞춤, 글자수 준수, 구체적 수치·사례 포함, CARL 구조(배경-행동-결과-배운점), 자연스러운 한국어.

반드시 아래 JSON으로만 응답:
{ "question": "${question.replace(/"/g, '\\"').substring(0, 100)}", "answer": "작성된 답변", "wordCount": 0, "highlightedValues": [] }`;
}

/**
 * AI PPT 포트폴리오: 링크형 포트폴리오 데이터를 합격자 스타일 PPT 슬라이드 JSON으로 변환.
 * templateHint: 'modern' | 'classic' | 'creative' | 'custom'
 * customTemplate: 사용자가 업로드한 템플릿의 슬라이드 구성(있으면 이 흐름을 모방)
 */
export function buildAiPptAnalyzePrompt({ portfolio, templateHint, customTemplate, baseDeck }) {
  // baseDeck가 있으면 polish-only 모드: 문구만 다듬고 동일 구조 반환
  if (baseDeck && Array.isArray(baseDeck.slides) && baseDeck.slides.length) {
    const target = `${portfolio.targetCompany || ''} ${portfolio.targetPosition || ''}`.trim();
    return `합격자 포트폴리오 PPT 컨설턴트입니다. 아래 슬라이드 deck의 문구를 더 임팩트 있게 다듬어주세요.

원칙(반드시 지킬 것):
- 슬라이드의 id, layout 그대로 유지
- bullet은 짧고 명사형(15자 내외), 두괄식, 수치/결과 강조
- items 안의 heading/period는 그대로 두되 body·bullets는 다듬어도 됨
- metrics 배열의 label/value/before/after는 절대 임의 변경 금지(원본 그대로 유지)
- 빈 bullet/items는 새로 만들지 말고 그대로 두세요
- 지원처: ${target || '미정'}에 부합하도록 강조 포인트만 조정

원본 deck (이 구조 그대로 같은 키로 응답):
${JSON.stringify(baseDeck).substring(0, 6000)}

응답 형식: 위와 동일한 { "meta": {...}, "slides": [...] } JSON만, 추가 설명 금지.`;
  }

  // (구버전 흐름 — 호환용)
  return _buildAiPptAnalyzePromptLegacy({ portfolio, templateHint, customTemplate });
}

function _buildAiPptAnalyzePromptLegacy({ portfolio, templateHint, customTemplate }) {
  const data = {
    title: portfolio.title,
    userName: portfolio.userName,
    userBirth: portfolio.userBirth,
    userAddress: portfolio.userAddress,
    targetCompany: portfolio.targetCompany,
    targetPosition: portfolio.targetPosition,
    contact: portfolio.contact || {},
    education: portfolio.education || [],
    experiences: (portfolio.experiences || []).map(e => {
      const sr = e.structuredResult || e.frameworkContent || {};
      const ov = sr.projectOverview || {};
      const keyExperiences = (sr.keyExperiences || e.keyExperiences || []).map(k => ({
        title: k.title,
        metric: k.metric,
        metricLabel: k.metricLabel,
        beforeMetric: k.beforeMetric,
        afterMetric: k.afterMetric,
        situation: k.situation,
        action: k.action,
        result: k.result,
      })).filter(k => k.title || k.metric || k.result);
      return {
        company: e.company || e.title,
        role: ov.role || e.role,
        period: ov.duration || e.period,
        goal: ov.goal,
        techStack: ov.techStack || e.skills,
        bullets: e.bullets,
        description: e.description || sr.intro || sr.overview || ov.summary,
        detail: e.detail,
        keyExperiences,
      };
    }),
    awards: portfolio.awards || [],
    skills: portfolio.skills || {},
    values: portfolio.values || portfolio.valuesEssay || portfolio.about,
    customSections: portfolio.customSections || [],
  };

  const customHint = customTemplate
    ? `사용자가 업로드한 템플릿의 슬라이드 흐름(이 순서·의도를 최대한 따르세요):
${JSON.stringify(customTemplate).substring(0, 1500)}`
    : '';

  return `당신은 합격자 포트폴리오 PPT 컨설턴트입니다. 아래 링크형 포트폴리오 데이터를 분석해
"${templateHint || 'modern'}" 톤의 PPT 슬라이드 8~12장으로 재구성하세요.

핵심 원칙:
- 합격자 PPT 기준: 한 슬라이드 한 메시지, 두괄식, 수치·기여도·결과 강조
- bullet은 명사형/짧게(15자 내외), 각 슬라이드 bullet 5개 이내
- 표지·프로필·교육·핵심경험(여러 장)·기술·수상·가치관·연락처/마무리 흐름
- 핵심 경험은 1슬라이드당 1프로젝트로 상세 분리
- ${data.targetCompany || ''} ${data.targetPosition || ''} 직무에 부합하는 경험을 앞쪽으로 배치
- ★중요: experiences의 keyExperiences(metric, metricLabel, beforeMetric, afterMetric)는 반드시 해당 프로젝트 슬라이드의 items[].metrics 배열로 포함시키세요. 지표가 없는 슬라이드는 비주얼 임팩트가 약합니다.

${customHint}

포트폴리오 데이터:
${JSON.stringify(data).substring(0, 5000)}

반드시 아래 JSON으로만 응답(추가 설명 금지):
{
  "meta": { "title": "표지 메인 카피", "subtitle": "부제(이름·지원처)", "accentColor": "#0F172A" },
  "slides": [
    {
      "id": "s1",
      "layout": "cover|profile|education|experience|skills|awards|values|contact|closing|section",
      "title": "슬라이드 헤딩",
      "subtitle": "보조 텍스트(선택)",
      "bullets": ["짧은 포인트", "..."],
      "items": [
        {
          "heading": "프로젝트명",
          "period": "2024.03-2024.06",
          "role": "역할/기여도",
          "body": "한 줄 요약",
          "bullets": ["성과/수치", "..."],
          "metrics": [
            { "label": "API 응답 시간", "value": "40% 단축", "before": "800ms", "after": "480ms" }
          ]
        }
      ],
      "notes": "발표자 메모(선택, 한 줄)"
    }
  ]
}

레이아웃별 사용 필드:
- cover: title, subtitle
- profile: title, bullets(이름/생년/거주지/연락처 등)
- education: title, items(heading=학교, period, body=전공)
- experience: title, items(1~2개 프로젝트 상세)
- skills: title, bullets(카테고리: 항목 형태)
- awards: title, bullets 또는 items
- values: title, bullets
- contact / closing: title, bullets
- section: 챕터 구분 표지 (title만)`;
}

/** 특정 슬라이드를 자연어 요청에 따라 재생성. */
export function buildAiPptRevisePrompt({ slide, instruction, portfolio }) {
  return `당신은 합격자 포트폴리오 PPT 편집자입니다. 아래 슬라이드를 사용자의 자연어 요청대로 수정하세요.
구조(layout/필드 키)는 유지하고 텍스트만 다듬으세요. bullet은 짧고 명사형, 수치 강조.

원본 슬라이드:
${JSON.stringify(slide).substring(0, 1500)}

사용자 요청: ${String(instruction || '').substring(0, 400)}

참고 포트폴리오 요약:
${JSON.stringify({
  name: portfolio.userName,
  target: `${portfolio.targetCompany || ''} ${portfolio.targetPosition || ''}`.trim(),
  experiences: (portfolio.experiences || []).slice(0, 5).map(e => e.company || e.title),
}).substring(0, 600)}

반드시 수정된 슬라이드 1개의 JSON만 응답(원본과 동일한 키 구조):`;
}

