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

/** 디자인 토큰 → 톤/어휘 가이드 한 줄. distill/mapping 양쪽에서 공유. */
function describeTemplateTone(designTokens) {
  if (!designTokens || typeof designTokens !== 'object') return '';
  const { bg, accent, side, sub, fontHeading, fontBody, layoutHint } = designTokens;
  const hexLuma = (hex) => {
    const m = typeof hex === 'string' ? hex.replace('#', '') : '';
    if (m.length !== 6) return 1;
    const r = parseInt(m.slice(0, 2), 16) / 255;
    const g = parseInt(m.slice(2, 4), 16) / 255;
    const b = parseInt(m.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const looksDark = hexLuma(bg) < 0.45;
  const isSerif = /(serif|noto serif|nanum myeongjo|times|garamond)/i.test(fontHeading || fontBody || '');
  const isMono = /(mono|jetbrains|consolas|fira code|d2coding)/i.test(fontHeading || fontBody || '');
  const moodWords = [];
  if (looksDark) moodWords.push('다크/하이엔드');
  if (isSerif) moodWords.push('정제·격식 (세리프)');
  if (isMono) moodWords.push('테크/엔지니어링 (모노)');
  if (!moodWords.length) moodWords.push('클린 모던 (산세리프)');
  const layoutLine = layoutHint
    ? `레이아웃: ${layoutHint} — ${{
        'sidebar-left': '좌측 컬러 사이드바 (이름/직무/연락처는 사이드바, 본문은 우측 큰 영역)',
        'sidebar-right': '우측 컬러 사이드바',
        'header-top': '상단 컬러 헤더 띠 (제목·발표자 정보 강조)',
        'footer-bottom': '하단 컬러 푸터 바 (이름/페이지네이션)',
        'block': '큰 컬러 블록 강조 (제목/메트릭에 임팩트)',
        'minimal': '여백 위주 미니멀 (개조식·짧은 문장이 더 어울림)',
      }[layoutHint] || ''}`
    : '';
  return [
    `[Template Visual Style]`,
    `톤: ${moodWords.join(' · ')}`,
    layoutLine,
    `색상: bg=${bg || '?'}, accent=${accent || '?'}, side=${side || '?'}, body=${sub || '?'}`,
    `폰트: heading=${fontHeading || 'Pretendard'}, body=${fontBody || 'Pretendard'}`,
  ].filter(Boolean).join('\n');
}

/**
 * Stage 1: 링크형 포트폴리오 전체(모든 섹션 + 경험·프로젝트)에서
 * "합격자 PPT 콘텐츠 팩"을 추출. 슬라이드 수에 맞춰 슬롯을 미리 계획.
 * 출력: 표지/스킬/경험별 STAR/성과/마무리 + 슬라이드 슬롯 시퀀스
 */
export function buildPortfolioDistillPrompt({ portfolioText, slideCount, designTokens = null, keyMetrics = [], narrativeSections = [], hasImages = false }) {
  const toneBlock = describeTemplateTone(designTokens);
  const metricsBlock = (keyMetrics || []).length
    ? `\n[Pre-extracted Key Metrics — 사용자 본문에서 결정적으로 뽑힌 정량 지표. JSON의 key_metrics 에 그대로 담을 것]\n${keyMetrics.slice(0, 12).join(' · ')}`
    : '';
  const sectionsBlock = (narrativeSections || []).length
    ? `\n[Narrative Sections — 사용자 노션형 에디터에서 헤딩으로 끊은 섹션 단위. 동일 heading 의 라인들은 같은 슬라이드 본문에 묶을 것]\n${narrativeSections.slice(0, 8).map(s => `· (${s.source}) ${s.heading || '(무제)'} → ${(s.lines || []).slice(0, 3).join(' / ')}`).join('\n')}`
    : '';
  const imagesBlock = hasImages ? '\n[Images Detected] 사용자가 첨부한 이미지가 있음. 가능한 슬라이드는 image-friendly 레이아웃으로 슬롯을 배치(intent="project" 우선).' : '';
  return `당신은 네카라쿠배 합격자 포트폴리오를 N년간 첨삭한 시니어 면접관입니다.
사용자의 [Link Portfolio Raw] 데이터에서 "진짜 합격자 PPT 포트폴리오"에 들어갈 핵심 포인트만 추출·정제하세요.
이 단계는 콘텐츠 추출이지만, 아래 [Template Visual Style] 톤에 맞춰
headline / tagline / values_keywords 의 어휘 톤을 살짝 맞춥니다 (다크·세리프=격식·결과중심, 미니멀=짧고 단정, 모노=테크·정량).
${toneBlock || ''}
${metricsBlock}
${sectionsBlock}
${imagesBlock}

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
  "key_metrics": ["P95 -42%", "MAU 12만", "전환율 +18%"],
  "narrative_sections": [
    { "heading": "프로젝트 A — 문제 해결", "lines": ["...", "..."], "metrics": ["P95 -42%"] }
  ],
  "slide_slots": [
    { "slideIndex": 0, "intent": "profile", "focus": "cover" },
    { "slideIndex": 1, "intent": "skills", "focus": "skills_overview" },
    { "slideIndex": 2, "intent": "project", "focus": "projects[0]" },
    { "slideIndex": 3, "intent": "result", "focus": "projects[0].result" }
  ]
}`;
}

/** Stage 2: 디자인-온리 레이아웃 지도 + 콘텐츠 팩 → shape별 텍스트/폰트 크기 매핑. */
export function buildDirectPptxTemplateMappingPrompt({ templateTitle, slides, portfolioText, contentPack, designTokens = null, slideSize = null }) {
  const slots = Array.isArray(contentPack?.slide_slots) ? contentPack.slide_slots : [];
  const slotLines = slots
    .map(s => `  - slide ${s.slideIndex}: intent="${s.intent}" focus="${s.focus}"`)
    .join('\n') || '  (없음 — 슬라이드 0=profile, 마지막=contact, 중간=skills/projects 순서로 자동 배정)';

  const toneBlock = describeTemplateTone(designTokens);
  const sizeBlock = slideSize?.w && slideSize?.h
    ? `슬라이드 캔버스: ${Math.round(slideSize.w)}pt × ${Math.round(slideSize.h)}pt`
    : '';

  // 레이아웃 힌트별 "어떤 shape에 어떤 콘텐츠를 우선 배치하라"는 추가 가이드
  const layoutGuide = (() => {
    const hint = designTokens?.layoutHint;
    switch (hint) {
      case 'sidebar-left':
      case 'sidebar-right':
        return `- 화면 ${hint === 'sidebar-left' ? '좌측' : '우측'} 약 25~35% 폭의 좁고 긴 박스(폭<height)는 사이드바 — \`summary.name\` / \`summary.role_target\` / \`summary.contact_lines\` 같은 짧은 메타 정보 우선.\n- 사이드바 외 큰 영역(중앙~반대편)에는 본문(STAR/Result/Skills) 배치.`;
      case 'header-top':
        return `- 슬라이드 상단 1/4 안쪽의 가로로 긴 박스(폭>>height)는 헤더 — \`Main Title\`은 여기에 우선 배치.\n- 본문/메트릭은 헤더 아래 큰 영역에.`;
      case 'footer-bottom':
        return `- 하단 1/6 안쪽의 가로 긴 박스는 푸터 — \`summary.name\` · 페이지 정보 등 짧은 메타.\n- 본문은 푸터 위 큰 영역에.`;
      case 'block':
        return `- 색이 진한 큰 색면 위에 올라가는 박스에는 \`Tag/Metric\`(정량 수치 1~3개) 또는 굵은 한 줄 헤드라인을 우선 — 색면이 강조 효과.`;
      case 'minimal':
        return `- 여백이 넉넉한 미니멀 톤이므로 모든 박스는 더 짧게(권장: 본문 ≤2줄, 각 줄 ≤24자). 개조식 명사형으로.`;
      default:
        return '';
    }
  })();

  return `당신은 합격자 PPT 포트폴리오의 레이아웃 디렉터입니다.
PPTX 템플릿은 **오직 디자인(배경·도형·색상·타이포·배치)** 만 참고합니다.
템플릿의 원본 텍스트는 입력에 포함되어 있지도 않으며, 추측하지도 마세요.

${toneBlock}
${sizeBlock}

[레이아웃 인지 배치 가이드 — 도형의 위치·크기를 먼저 보고 어떤 콘텐츠를 넣을지 정함]
${layoutGuide || '- 폭이 슬라이드 가로의 60% 이상이면 본문 영역, 30% 이하 좁고 긴 박스면 메타/태그 영역으로 간주.'}
- 같은 슬라이드 안에서 가장 큰 텍스트 박스(원본 폰트 또는 폭×높이 최대)는 Main Title 후보.
- 슬라이드 상단부(y_pt가 슬라이드 높이의 30% 이내) + 큰 폭 박스 = 제목/헤더.
- 슬라이드 하단부(y_pt가 75% 이상)의 작은 박스 = 푸터/연락처/페이지번호.
- 가로로 짧고 사각형 형태(가로:세로 ≈ 1:1)의 박스는 Tag/Metric 우선 (수치/키워드 1~2개).

──────────────────────────────────────────────
[강제 규칙 — 위반 시 결과를 폐기합니다]
──────────────────────────────────────────────
A) 슬라이드 의도(intent)는 아래 [Slide Slots] 를 그대로 따른다. 절대 변경 금지.
B) intent 와 shape 의 role_hint 가 결정한 "콘텐츠 카테고리" 만 그 박스에 넣는다.
   아래 [Shape Recipe Table] 을 그대로 적용. 추측 금지.
C) **Fit to Box — 절대 글자수 방어 (위반 시 결과 폐기):**
   - new_text 의 **공백 포함 총 글자수 ≤ char_budget**. 출력 직전 반드시 \`new_text.length\` 를 카운트해서 검증.
   - 글자수가 초과되면 의미를 압축한 더 짧은 표현으로 교체. 예) "응답 속도를 50% 개선했습니다"(17자) → "응답 속도 50% 개선"(11자).
   - 줄바꿈(\\n)도 1자로 포함하여 카운트.
   - 절대 "..." / "…" / "(중략)" / 잘린 단어로 끝내지 마라. 잘릴 거면 그 표현 자체를 더 짧은 표현으로 새로 쓴다.
   - 글자수가 도저히 안 맞으면 font_size_pt 를 original_font_size_pt-2 로 1단계만 축소(최소 10pt).
C-2) **작은 박스 보호 (필수):**
   - char_budget < 12 인 박스에는 절대 이메일/URL/연락처/긴 문장을 넣지 마라.
     해당 박스에는 키워드 1개(예: "AI", "Full-Stack"), 숫자 지표(예: "150ms"), 또는 페이지 번호류만.
   - char_budget < 8 인 박스는 1~3자 키워드/숫자 전용. 사람 이름(2~4자) 또는 카테고리 약어("FE", "AI", "01")만.
   - 이메일/URL은 \`char_budget ≥ 표현전체길이\` 인 박스에만 통째로 넣는다(잘라서 넣기 금지).
D) 같은 슬라이드 내 동일 문구 중복 배치 금지.
E) 없는 사실/없는 수치/없는 기술스택은 만들지 않는다 (Content Pack 에 있는 값만 사용).
F) 마크다운/이모지/괄호 장식 금지. 줄바꿈은 \\n.
G) **Key Metric 우선 배치**: \`contentPack.key_metrics\` 에 값이 있으면 슬라이드마다 1개의 Tag/Metric 박스(가능한 가장 작은 사각형)에 그 수치를 그대로 박는다. 합격자 PPT의 핵심은 "수치로 결과 증명" — 본문 중복 사용 금지, 수치 박스에만.
H) **헤딩-본문 묶음**: 한 슬라이드의 Main Title 은 \`contentPack.narrative_sections[*].heading\` 또는 \`projects[focus].title\` 만 사용. Body 의 줄들은 같은 섹션의 \`lines\` 에서 가져와 STAR 형태로 압축한다 (다른 섹션 라인을 섞지 않음).
I) **빈칸 방치 금지**: Layout Map 에 주어진 모든 \`shape_id\` 를 빠짐없이 \`shapes\` 배열에 포함하여 \`new_text\` 를 채워라. Content Pack 이 부족하면 가장 어울리는 키워드 1개라도 채운다(빈 문자열 금지).
J) **줄 길이 통제**: Body 박스에서 한 줄(\\n 사이)의 길이 ≤ char_budget / 줄수 권장. 한 줄이 박스 폭을 넘기지 않도록 개조식 짧은 명사형(~함, ~구축, ~50% 개선)으로 끊어 쓴다.

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

intent="education" (학력)
  · Main Title    → "Education" 또는 "학력"
  · Body          → \`education[*].title\` + " · " + \`detail\` 줄로 나열
  · Subtext       → \`education[*]\` 의 부가 정보

intent="award" (수상/자격)
  · Main Title    → "Awards & Certifications" 또는 "수상 내역"
  · Body          → \`awards[*].title\` + " · " + \`awards[*].detail\` 줄로 나열 (각 줄 ≤ 28자)
  · Tag/Metric    → 가장 임팩트 큰 수상 1개 (예: "최우수상 1위")
  · Subtext       → 수상 기관 또는 연도

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

★ experience 레이아웃 슬라이드 추가 규칙 (합격자 PPT 핵심):
- layout_type: 'SPLIT_HALF' | 'CENTER_METRIC' | 'STACK_LIST' 중 하나
  · CENTER_METRIC: highlight_metric이 있고 details 텍스트가 매우 짧을 때 (큰 지표 한방)
  · SPLIT_HALF: highlight_metric + STAR(P/A/R) 모두 있을 때 (좌우 분할)
  · STACK_LIST: 지표가 약하거나 일반 bullet 위주일 때
  → 원본 layout_type을 존중하되, 분량에 맞지 않으면 위 기준으로 변경 가능
- details.problem / details.action / details.result : STAR(문제-행동-성과) 구조로 다듬기
  · 각 항목 1~3개의 짧은 명사형 문장 (40자 이내)
  · problem = 어떤 문제/상황이었는가 (수 초 이상 걸리던 불안정한 API 응답…)
  · action = 어떤 행동을 했는가 (Fail-fast 패턴 적용, 상태 코드 명시적 분기…)
  · result = 어떤 성과를 냈는가 (150ms 내외 안정화, 디버깅 시간 50% 단축…)
- highlight_metric { label, value, before, after } : 절대 임의 변경 금지(원본 그대로)

원본 deck (이 구조 그대로 같은 키로 응답):
${JSON.stringify(baseDeck).substring(0, 8000)}

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

