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
export function buildPortfolioDistillPrompt({ portfolioText, slideCount, designTokens = null, keyMetrics = [], narrativeSections = [], projectBriefs = [], hasImages = false }) {
  const toneBlock = describeTemplateTone(designTokens);
  const metricsBlock = (keyMetrics || []).length
    ? `\n[Pre-extracted Key Metrics — 사용자 본문에서 결정적으로 뽑힌 정량 지표. JSON의 key_metrics 에 그대로 담을 것]\n${keyMetrics.slice(0, 12).join(' · ')}`
    : '';
  const sectionsBlock = (narrativeSections || []).length
    ? `\n[Narrative Sections — 사용자 노션형 에디터에서 헤딩으로 끊은 섹션 단위. 동일 heading 의 라인들은 같은 슬라이드 본문에 묶을 것]\n${narrativeSections.slice(0, 8).map(s => `· (${s.source}) ${s.heading || '(무제)'} → ${(s.lines || []).slice(0, 3).join(' / ')}`).join('\n')}`
    : '';
  // 결정적 per-project 브리프: 각 프로젝트의 문제정의·기술스택·지표를 미리 뽑아 AI 가 빠뜨리지 않게 강제 주입
  const briefsBlock = (projectBriefs || []).length
    ? `\n[Pre-extracted Project Briefs — 각 프로젝트의 결정적 추출. projects[i] 에 그대로 반영하되 표현만 합격자 톤으로 다듬을 것. 절대 누락 금지]\n${projectBriefs.slice(0, 6).map((b, i) => {
        const meta = [b.role, b.period].filter(Boolean).join(' · ');
        const tech = b.tech_stack?.length ? `\n    tech_stack: ${b.tech_stack.join(' · ')}` : '';
        const prob = b.problem?.length ? `\n    problem: ${b.problem.join(' / ')}` : '';
        const act = b.action?.length ? `\n    action: ${b.action.join(' / ')}` : '';
        const res = b.result?.length ? `\n    result: ${b.result.join(' / ')}` : '';
        const ms = b.metrics?.length ? `\n    metrics: ${b.metrics.join(' · ')}` : '';
        return `[${i}] ${b.title}${meta ? ` (${meta})` : ''}${tech}${prob}${act}${res}${ms}`;
      }).join('\n')}`
    : '';
  const imagesBlock = hasImages ? '\n[Images Detected] 사용자가 첨부한 이미지가 있음. 가능한 슬라이드는 image-friendly 레이아웃으로 슬롯을 배치(intent="project" 우선).' : '';
  return `당신은 네카라쿠배 합격자 포트폴리오를 N년간 첨삭한 시니어 면접관입니다.
사용자의 [Link Portfolio Raw] 데이터에서 "진짜 합격자 PPT 포트폴리오"에 들어갈 핵심 포인트만 추출·정제하세요.

──────────────────────────────────────────────
[CORE RULES — 절대 준수]
1) 템플릿의 기존 텍스트는 완전히 무시한다. 템플릿은 레이아웃·공간·디자인 톤(색·폰트·배치)만 참고한다.
2) 사용자의 노션형 포트폴리오 데이터를 "이 사람이 어떤 방식으로 문제를 보고 움직이는지 증명하는 포트폴리오"로 재구성한다.
3) 데이터 누락 금지: 모든 섹션을 반영하되, 특히 다음 세 가지는 반드시 돋보이게 포함한다.
   ① 성과 지표(정량 수치·데이터 시각화 요소 — %, 시간, 인원, 매출, before/after) → key_metrics + projects[*].metrics 에 빠짐없이.
   ② 판단 과정(problem_evidence · alternatives · decision_criteria · changed_judgment) → 결과보다 먼저 논리가 읽히게.
   ③ 증거와 원문 말투(evidence · original_quote) → 주장을 실제 화면·문서·데이터와 연결.
   이 세 항목은 발표 가치가 가장 높으므로, 약하면 다른 사족을 줄여서라도 분량을 확보한다.
──────────────────────────────────────────────

이 단계는 콘텐츠 추출이지만, 아래 [Template Visual Style] 톤에 맞춰
headline / tagline / values_keywords 의 어휘 톤을 살짝 맞춥니다 (다크·세리프=격식·결과중심, 미니멀=짧고 단정, 모노=테크·정량).
${toneBlock || ''}
${metricsBlock}
${sectionsBlock}
${briefsBlock}
${imagesBlock}

[추출 원칙]
1. 모든 섹션을 빠짐없이 훑되, 발표 가치가 낮은 사족(중복 자기소개, 일반론)은 과감히 버린다.
2. 각 프로젝트/경험은 **상황 → 문제 판단과 근거 → 검토한 대안 → 선택 기준 → 직접 실행 → 결과와 증거 → 바뀐 판단** 구조로 요약. 행동 목록만 길게 만들지 않음.
3. **problem(문제정의)**: 사용자가 마주한 구체적 문제·맥락 1~2줄. 모호한 일반론 금지("UX를 개선하고 싶었음" X → "신규 가입 후 7일 이내 이탈률 38%였음" O).
4. **tech_stack**: Pre-extracted Project Briefs 의 tech_stack 을 그대로 보존. 임의 누락·각색 금지. 없는 기술은 추가하지 않음.
5. **action(행동)**: 어떤 기술/방법을 어떻게 적용했는지 3~5개. 각 항목 ≤ 30자 개조식("Redis 캐시 도입해 응답시간 절감", "에러바운더리로 결제 흐름 보호").
6. **result(결과)**: 정량 수치 우선 2~4개. 수치 없는 결과는 사용자 만족도/배포 등 검증 가능한 사실만.
7. 정량 수치(%·시간·인원·매출 등)와 사용 기술스택은 반드시 보존. 없는 수치는 만들지 않는다.
8. 합격자 화법: 개조식("~함", "~적용해 ~달성"), 능동·구체·결과 중심. 마크다운 금지.
9. 섹션이 비었거나 약한 항목은 빈 배열로 둔다 (억지로 채우지 않음).
10. 한 줄 길이 ≤ 38자 권장.

[summary 필수 필드 — 절대 비워두지 말 것]
- summary.name: 입력에 이름이 명시되어 있으면 그대로. 없으면 "이름 미상" (절대 스킬/문장으로 채우지 말 것).
- summary.headline: "나는 어떤 사람인가"에 답하는 문장. 서로 다른 경험 2개 이상에서 반복된 문제 인식·판단·실행 패턴을 찾아 정의합니다. 직무명+추상 역량 조합("데이터 기반 문제 해결형 PM")은 금지. 반복 근거가 부족하면 입력 headline을 보존하고 새 정체성을 단정하지 않습니다.
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
      "tech_stack": ["React", "TypeScript", "Node.js", "Redis", "PostgreSQL"],
      "problem": "구체적 문제 1줄 (≤40자, 정량 맥락 포함)",
      "problem_evidence": "왜 이것을 문제로 판단했는지 보여주는 관찰·데이터·사용자 말",
      "situation": "사업·팀 맥락 1줄",
      "task": "내가 해결할 과제 1줄",
      "alternatives": ["실제로 검토한 대안과 포기 이유"],
      "decision_criteria": ["최종 선택을 가른 기준"],
      "action": ["기술 X 적용해 Y 구축 (≤30자)", "...", "..."],
      "result": ["P95 응답 -42%", "전환율 +18%", "..."],
      "evidence": ["주장을 확인할 화면·문서·데이터·피드백·원본"],
      "original_quote": "자료 속 사용자의 실제 문장. 없으면 빈 문자열",
      "changed_judgment": "예상과 달랐던 결과와 이후 바뀐 판단",
      "metrics": ["P95 -42%", "전환율 +18%"],
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

/** AI PPT 분석 — 노션형 포트폴리오 → SlidePreview 호환 deck JSON */
export function buildAiPptAnalyzePrompt({ portfolio, templateHint, customTemplate, baseDeck }) {
  if (baseDeck && Array.isArray(baseDeck.slides) && baseDeck.slides.length) {
    const target = `${portfolio.targetCompany || ''} ${portfolio.targetPosition || ''}`.trim();
    return `You are a senior career coach and UI/UX portfolio designer who has reviewed thousands of winning IT portfolios.
Your mission is to rewrite the provided deck text so it becomes a clear growth narrative, not a data dump.

Narrative arc to preserve across the deck:
1. Intro: one-line positioning and core value proposition.
2. Problem: the technical or business problem behind each project.
3. Decision: the chosen solution, tradeoff, and why it was reasonable.
4. Impact: quantitative or qualitative result grounded in the source data.
5. Vision: what the candidate learned and how that becomes future contribution.

Density rules:
- One slide = one message.
- Keep bullets/items to 3-4 per slide.
- Keep each sentence under 50 Korean characters or 18 English words when possible.
- Keep sectionLabel/footer keywords under 20 characters. Never put a full sentence in the footer.
- If a slide is too dense, compress first; if compression loses logic, mark notes with "shouldSplit:true".
- Do not invent metrics, companies, awards, dates, tools, or roles. Refine wording only from the source.

포트폴리오형 PPT 편집자입니다. 아래 1번 템플릿 deck의 문구만 다듬어주세요.

원칙(반드시 지킬 것):
- 슬라이드의 id, layout, sectionLabel, proposalVariant, dark, table, metrics, 순서 그대로 유지
  - '목차', '포트폴리오 개요', '경험 흐름', '대표 프로젝트', '직무 적합성', '성장 계획', '마무리' 흐름과 1번 템플릿 장표 수를 절대 줄이지 말 것
- proposalVariant(contents, threeCards, splitPhotoList, timeline, darkStats, bubbleCore, comparison, metricBars, graphCallout, synergy, venn, stairSteps, roleTable, targetCircle, caseGrid, testimonial, conditionGrid, criteria, gantt, stageCards, pyramid, faqCards, promise, budget, risk, orbit, closing 등)는 절대 변경하지 말 것
- profile, education, experience, skills, awards, values, contact 레이아웃을 새로 만들거나 제목으로 쓰지 말 것
- '프로필', 'Education', '학력', '핵심 경험' 같은 기존 포트폴리오 섹션명으로 되돌리지 말 것
  - 회사 소개, 서비스 소개, 채용 대행, 비용/계약 조건처럼 보이는 문구는 쓰지 말 것
  - 포트폴리오 문서/노션 페이지 형식으로 바꾸지 말고, 첨부 PPT 이미지처럼 전문적인 발표형 섹션 구성으로 유지할 것
- 장표 구조/구성/순서는 수정 금지. 제목·본문 표현만 더 자연스럽게 정리할 것
- bullet은 짧고 명사형(15자 내외), 두괄식, 수치/결과 강조
- items 안의 heading/period는 그대로 두되 body·bullets는 다듬어도 됨
- metrics 배열의 label/value/before/after는 절대 임의 변경 금지(원본 그대로 유지)
- 빈 bullet/items는 새로 만들지 말고 그대로 두세요
- 지원처: ${target || '미정'}에 부합하도록 강조 포인트만 조정

원본 deck (이 구조 그대로 같은 키로 응답):
${JSON.stringify(baseDeck).substring(0, 8000)}

응답 형식: 위와 동일한 { "meta": {...}, "slides": [...] } JSON만, 추가 설명 금지.`;
  }
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
        title: k.title, metric: k.metric, metricLabel: k.metricLabel,
        beforeMetric: k.beforeMetric, afterMetric: k.afterMetric,
        situation: k.situation, action: k.action, result: k.result,
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
    ? `사용자가 업로드한 템플릿의 슬라이드 흐름:\n${JSON.stringify(customTemplate).substring(0, 1500)}`
    : '';
  return `You are a professional career coach and senior UI/UX presentation designer.
Create a PPT deck JSON that converts a Notion-style document into a presentation story.

Core mission:
- Build a clear growth narrative: Intro -> Problem -> Decision -> Impact -> Vision.
- Translate long document sections into slide scenes.
- Each slide should make one sharp point, not list every field.
- Use only provided facts. You may polish wording, but must not invent missing metrics or history.

Slide mapping guide:
- Cover: userName/headline -> one-line positioning.
- Case Study: experiences/yooptaContent -> Problem, constraint, decision, result.
- Skill Map: skills -> group by practical use case, not a flat list.
- Growth: goals/valuesEssay -> connect past learning to future contribution.

Content constraints:
- 8-12 slides unless the data clearly needs fewer.
- Max 3-4 bullets/items per slide.
- Keep one sentence under 50 Korean characters or 18 English words.
- Keep sectionLabel/footer keywords under 20 characters. Never put a full sentence in the footer.
- If source content is long, summarize aggressively or split into Part 1 / Part 2.

당신은 합격자 포트폴리오 PPT 컨설턴트입니다. 아래 포트폴리오 데이터를 분석해
"${templateHint || 'modern'}" 톤의 PPT 슬라이드 8~12장으로 재구성하세요.

핵심 원칙:
- 합격자 PPT 기준: 한 슬라이드 한 메시지, 두괄식, 수치·기여도·결과 강조
- bullet은 명사형/짧게(15자 내외), 각 슬라이드 bullet 5개 이내
- 표지·프로필·교육·핵심경험(여러 장)·기술·수상·가치관·연락처/마무리 흐름
- 핵심 경험은 1슬라이드당 1프로젝트로 상세 분리
- ${data.targetCompany || ''} ${data.targetPosition || ''} 직무에 부합하는 경험을 앞쪽으로 배치
- ★중요: experiences의 keyExperiences(metric, metricLabel, beforeMetric, afterMetric)는 반드시 해당 프로젝트 슬라이드의 items[].metrics 배열로 포함

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
      "bullets": ["짧은 포인트"],
      "items": [{ "heading": "프로젝트명", "period": "2024.03-06", "role": "역할", "body": "한 줄 요약", "bullets": ["성과"], "metrics": [{"label":"응답시간","value":"40% 단축","before":"800ms","after":"480ms"}] }],
      "notes": ""
    }
  ]
}`;
}

/** 단일 슬라이드 AI 수정 프롬프트 */
export function buildAiPptRevisePrompt({ slide, instruction, portfolio }) {
  return `당신은 합격자 포트폴리오 PPT 편집자입니다. 아래 슬라이드를 사용자의 요청대로 수정하세요.
구조(layout/필드 키)는 유지하고 텍스트만 다듬으세요. bullet은 짧고 명사형, 수치 강조.

원본 슬라이드:
${JSON.stringify(slide).substring(0, 1500)}

사용자 요청: ${String(instruction || '').substring(0, 400)}

참고 포트폴리오:
${JSON.stringify({ name: portfolio.userName, target: `${portfolio.targetCompany || ''} ${portfolio.targetPosition || ''}`.trim(), experiences: (portfolio.experiences || []).slice(0, 5).map(e => e.company || e.title) }).substring(0, 600)}

반드시 수정된 슬라이드 1개의 JSON만 응답(원본과 동일한 키 구조):`;
}

// ─────────────────────────────────────────────
// 테마별 전문가 포트폴리오 생성 프롬프트
// popoldesign.md 에 정의된 10개 테마의 프레임워크·내러티브 구조에 맞춰
// 경험 데이터를 visual_sections 배열로 변환.
//
// visual_sections 타입:
//   hero          – 이름/직무/태그라인
//   metric_cards  – before→after 지표 카드 그리드
//   star_block    – 문제-행동-결과 STAR 구조 프로젝트 블록
//   aarrr_funnel  – Acquisition→Revenue 퍼널 지표 카드
//   diamond_steps – Discover→Define→Develop→Deliver 4단계
//   traction_timeline – 타임라인 카드 (스타트업)
//   skill_matrix  – 기술 스택 그룹 표
//   bento_grid    – 대시보드형 KPI 카드 (3~6개)
//   hypothesis_log – 가설/피벗 로그 카드
//   text_block    – 서술형 텍스트 섹션
//   closing       – 연락처/CTA
// ─────────────────────────────────────────────

const THEME_FRAMEWORK_GUIDE = {
  'theme-lean-dev': {
    name: 'Lean Hypothesis Dev',
    framework: 'Google XYZ + Lean Canvas',
    sections: ['hero', 'metric_cards', 'star_block', 'hypothesis_log', 'skill_matrix', 'closing'],
    tone: '간결한 수치 중심, 실패한 가설도 투명하게, 테크/엔지니어링',
    structureGuide: `
- hero: 이름·직무 + 핵심 임팩트 지표 1~2개 태그라인
- metric_cards: keyExperiences의 before/after 지표 최대 4개
- star_block(들): 각 프로젝트 → XYZ 공식(X를 Y로 측정해 Z 달성) + Pivot Log
- hypothesis_log: 실패한 가설과 피벗 과정 카드 (있으면)
- skill_matrix: 기술 스택 그룹 (Languages/Frameworks/Infra/Tools)
- closing: GitHub + 라이브 서비스 링크`,
  },
  'theme-notion-pm': {
    name: 'Structured Notion PM',
    framework: 'STAR + Trade-off Log',
    sections: ['hero', 'metric_cards', 'star_block', 'text_block', 'closing'],
    tone: '구조화된 문서형, 트레이드오프 결정 로직 강조, 비즈니스 임팩트',
    structureGuide: `
- hero: 프로덕트 철학 한 줄 + 대표 KPI
- metric_cards: DAU/MAU, 리텐션, CVR 등 프로덕트 지표
- star_block(들): Context & User Problem → KPI Setup → Trade-off Log → Result & Next Step
- text_block: 사용자 인터뷰 인용구 or 핵심 의사결정 배경
- closing: Notion 원본 이력서 + 이메일`,
  },
  'theme-double-diamond': {
    name: 'Double Diamond Creative',
    framework: 'Double Diamond 4-Steps',
    sections: ['hero', 'diamond_steps', 'metric_cards', 'skill_matrix', 'closing'],
    tone: '이미지:텍스트=7:3, 비주얼 임팩트, 문제 해결자로서의 디자이너',
    structureGuide: `
- hero: 시선 사로잡는 핵심 문제 정의 문장 + 결과 지표
- diamond_steps: Discover(리서치) → Define(문제정의/페르소나) → Develop(아이디에이션) → Deliver(최종 UI+UT 결과)
- metric_cards: Task 성공률, 체류 시간, 재사용률
- skill_matrix: Design Tools / Research Methods / Systems
- closing: Figma 프로토타입 + Dribbble 링크`,
  },
  'theme-bento-metric': {
    name: 'Bento Metric Strategist',
    framework: 'AARRR Funnel Metrics',
    sections: ['hero', 'bento_grid', 'aarrr_funnel', 'star_block', 'skill_matrix', 'closing'],
    tone: '숫자와 퍼센트가 주인공, Before→After 형태 필수, 허영 지표 배제',
    structureGuide: `
- hero: 누적 매출/트래픽 핵심 숫자 3개
- bento_grid: 가장 임팩트 큰 KPI 3~6개 대시보드 카드
- aarrr_funnel: Acquisition→Activation→Retention→Revenue→Referral 각 지표
- star_block(들): 그로스 실험 → 지표 Before/After → 인사이트
- closing: Tableau/Looker 대시보드 링크`,
  },
  'theme-startup-hustler': {
    name: 'Startup Hustler',
    framework: 'Problem-Solution-Fit & MVP',
    sections: ['hero', 'metric_cards', 'traction_timeline', 'star_block', 'closing'],
    tone: '거칠고 강렬한, 실행 속도 강조, MVP 출시 일수와 초기 지표',
    structureGuide: `
- hero: 해결하려는 시장의 문제 + "X일 만에 배포"
- metric_cards: CAC, 초기 전환율, 출시 기간
- traction_timeline: 아이디어→MVP→첫 결제→주요 피벗 타임라인
- star_block(들): Market Pain Point → MVP Action → Early Traction → Learnings
- closing: Calendly 커피챗 링크`,
  },
  'theme-research-archival': {
    name: 'Research Archival',
    framework: 'Empathy to Insight',
    sections: ['hero', 'text_block', 'star_block', 'metric_cards', 'closing'],
    tone: '논문형 서술, 방법론과 표본 수 명시, 인사이트가 비즈니스로 연결',
    structureGuide: `
- hero: 연구 분야 요약 + 핵심 키워드 태그
- text_block: Research Goal + Methodology (N수, 정성/정량) 
- star_block(들): Research Goal → Methodology → Key Insights → Business Impact
- metric_cards: 표본 수(N), 신뢰수준, 절감된 개발 비용/시간
- closing: 리서치 리포트 PDF 다운로드`,
  },
  'theme-cyberpunk': {
    name: 'Data Flow Cyberpunk',
    framework: 'CAR + Architecture',
    sections: ['hero', 'metric_cards', 'star_block', 'skill_matrix', 'text_block', 'closing'],
    tone: '터미널 스타일, TPS/Latency/SLA 수치 중심, 아키텍처 다이어그램 강조',
    structureGuide: `
- hero: 처리한 최대 트래픽 수치 + 역할
- metric_cards: TPS, Latency ms, Uptime%, 비용 절감$
- star_block(들): System Context(규모/한계) → Architecture Design → Action(병목해결) → Result(성능지표)
- skill_matrix: Backend/Infra/DB/Monitoring 기술 스택
- text_block: 핵심 트러블슈팅 1개 상세
- closing: Tech Blog + GitHub`,
  },
  'theme-ats-classic': {
    name: 'ATS-Optimized Classic',
    framework: 'Reverse-Chronological',
    sections: ['hero', 'star_block', 'skill_matrix', 'text_block', 'closing'],
    tone: '키워드 밀도 최대화, 역순 연대기, 행동 동사로 시작, 수치 앞에 배치',
    structureGuide: `
- hero: 이름 + 지원 직무 타이틀 + 핵심 스킬 키워드 리스트
- star_block(들): Company & Role → Key Responsibilities → Quantified Achievements (역순)
- skill_matrix: 직무 키워드 중심 기술 스택
- text_block: Executive Summary (3문장)
- closing: 이력서 PDF 다운로드`,
  },
  'theme-component-creator': {
    name: 'Component-Driven Creator',
    framework: 'Interactive Component Logs',
    sections: ['hero', 'metric_cards', 'star_block', 'skill_matrix', 'closing'],
    tone: '텍스트 최소화, 코드 스니펫과 성능 지표 중심, 인터랙션 품질 강조',
    structureGuide: `
- hero: 라이브 Playground 한 줄 소개 + Lighthouse 점수
- metric_cards: 렌더링 fps, 번들 사이즈 kb, 컴포넌트 재사용률
- star_block(들): UI Preview → Tech Challenge → Code Solution → Performance
- skill_matrix: Frontend/State/Testing/Tooling
- closing: CodeSandbox + Storybook 링크`,
  },
  'theme-sustainable': {
    name: 'Sustainable Impact',
    framework: 'Impact & Sustainability Logic Model',
    sections: ['hero', 'metric_cards', 'star_block', 'text_block', 'closing'],
    tone: '스토리텔링 서술, SDGs 매핑, 이해관계자 조율 과정, 사회적 가치 수치',
    structureGuide: `
- hero: 소셜 미션 선언문 + 누적 임팩트 수치
- metric_cards: 수혜자 수, 탄소 절감량, 펀딩 금액, SDGs 번호
- star_block(들): Social Problem → Stakeholders 조율 → Output → Outcome/Impact
- text_block: 이해관계자 인터뷰 & 변화 사례
- closing: 임팩트 리포트 PDF`,
  },
};

/** 테마 ID → 테마 설정 조회 */
function getThemeFramework(themeId) {
  return THEME_FRAMEWORK_GUIDE[themeId] || THEME_FRAMEWORK_GUIDE['theme-lean-dev'];
}

/**
 * 테마별 전문가 포트폴리오 생성 프롬프트.
 * 경험 구조화 데이터(keyExperiences, techStack, metrics 등)를
 * 테마 프레임워크에 맞는 visual_sections 배열로 변환.
 *
 * @param {{ themeId, experiencesData, portfolioMeta }} opts
 */
export function buildThemedPortfolioPrompt({ themeId, experiencesData, portfolioMeta }) {
  const theme = getThemeFramework(themeId);

  // 경험 데이터 직렬화 (핵심 필드만)
  const expSummary = (experiencesData || []).slice(0, 8).map((exp, idx) => {
    const sr = exp.structuredResult || exp.frameworkContent || {};
    const ov = sr.projectOverview || {};
    const keyExps = (sr.keyExperiences || exp.keyExperiences || []).map(k => ({
      title: k.title,
      metric: k.metric, metricLabel: k.metricLabel,
      beforeMetric: k.beforeMetric, afterMetric: k.afterMetric,
      situation: k.situation, action: k.action, result: k.result,
    })).filter(k => k.title || k.metric);

    return {
      idx,
      title: exp.company || exp.title || `경험 ${idx + 1}`,
      role: ov.role || exp.role || '',
      period: ov.duration || exp.period || '',
      techStack: ov.techStack || exp.skills || [],
      intro: sr.intro || sr.overview || ov.summary || exp.description || '',
      task: sr.task || '',
      process: sr.process || '',
      output: sr.output || '',
      growth: sr.growth || '',
      // 직군 특화 필드
      optimization: sr.optimization || '',
      troubleshooting: sr.troubleshooting || '',
      businessImpact: sr.businessImpact || sr.msc || '',
      hypothesis: sr.hypothesis || '',
      infraArch: sr.infraArch || '',
      researchApproach: sr.researchApproach || '',
      keyExperiences: keyExps,
    };
  });

  const metaBlock = portfolioMeta ? `
[Portfolio Meta]
이름: ${portfolioMeta.userName || ''}
지원 직무: ${portfolioMeta.targetPosition || ''}
지원 기업: ${portfolioMeta.targetCompany || ''}
연락처: ${JSON.stringify(portfolioMeta.contact || {})}` : '';

  return `당신은 ${theme.name} 전문가 포트폴리오를 제작하는 시니어 컨설턴트입니다.
아래 경험 데이터를 "${theme.framework}" 프레임워크에 맞게 professional한 포트폴리오로 변환하세요.
${metaBlock}

[테마 톤/방향]
${theme.tone}

[섹션 구성 가이드 — 반드시 준수]
${theme.structureGuide}

[경험 데이터]
${JSON.stringify(expSummary, null, 0).substring(0, 8000)}

─────────────────────────────────────────────
[visual_sections 타입별 스키마 — 정확히 준수]

▸ type: "hero"
{ "id": "hero", "type": "hero", "name": "이름", "role": "직무 타이틀",
  "tagline": "핵심 가치 한 줄 (≤35자)", "tags": ["키워드1","키워드2","키워드3"],
  "impact_summary": "가장 임팩트 큰 성과 한 줄" }

▸ type: "metric_cards"
{ "id": "metrics", "type": "metric_cards", "heading": "핵심 성과 지표",
  "cards": [
    { "label": "지표명", "value": "수치+단위", "direction": "up|down|neutral",
      "before": "이전값", "after": "이후값", "context": "짧은 배경" }
  ] }

▸ type: "star_block"
{ "id": "proj-0", "type": "star_block", "heading": "프로젝트명 (≤28자)",
  "subheading": "역할 · 기간", "tech_stack": ["React","Node.js"],
  "problem": "구체적 문제 (정량 맥락 포함, ≤45자)",
  "action": ["행동 1 (≤30자)", "행동 2", "행동 3"],
  "result": ["결과 1 (수치 포함)", "결과 2"],
  "metrics": [{ "label": "지표", "value": "수치", "before": "이전", "after": "이후" }],
  "learning": "한 줄 배움 (≤32자)" }

▸ type: "aarrr_funnel"
{ "id": "funnel", "type": "aarrr_funnel", "heading": "AARRR 퍼널 성과",
  "funnels": [
    { "stage": "Acquisition|Activation|Retention|Revenue|Referral",
      "metric": "지표명", "value": "수치", "before": "", "after": "" }
  ] }

▸ type: "diamond_steps"
{ "id": "diamond", "type": "diamond_steps", "heading": "디자인 프로세스",
  "steps": [
    { "step": "Discover|Define|Develop|Deliver", "title": "단계 제목",
      "bullets": ["포인트1", "포인트2"], "outcome": "이 단계 결과물" }
  ] }

▸ type: "traction_timeline"
{ "id": "timeline", "type": "traction_timeline", "heading": "실행 타임라인",
  "events": [
    { "date": "2024.03", "label": "이벤트명", "description": "한 줄 설명",
      "type": "milestone|pivot|launch|metric" }
  ] }

▸ type: "skill_matrix"
{ "id": "skills", "type": "skill_matrix", "heading": "기술 스택",
  "groups": [
    { "label": "그룹명", "items": ["기술1","기술2"] }
  ] }

▸ type: "bento_grid"
{ "id": "bento", "type": "bento_grid", "heading": "핵심 지표 대시보드",
  "cards": [
    { "title": "카드 제목", "value": "핵심 수치", "unit": "단위",
      "description": "짧은 설명 (≤25자)", "size": "large|medium|small" }
  ] }

▸ type: "hypothesis_log"
{ "id": "hypo", "type": "hypothesis_log", "heading": "가설 검증 로그",
  "logs": [
    { "hypothesis": "검증한 가설", "result": "success|fail|pivot",
      "learning": "배운 점", "pivot_to": "피벗 방향 (fail/pivot 시)" }
  ] }

▸ type: "text_block"
{ "id": "text-0", "type": "text_block", "heading": "섹션 제목",
  "paragraphs": ["문단1 (3줄 이내)", "문단2"] }

▸ type: "closing"
{ "id": "closing", "type": "closing", "cta_text": "Call-to-Action 문구",
  "links": [{ "label": "GitHub", "url": "" }, { "label": "이메일", "url": "" }] }
─────────────────────────────────────────────

[생성 원칙 — 절대 준수]
1. 경험 데이터에 없는 수치를 창작하지 않는다. 수치가 없으면 정성적 표현만.
2. 테마 섹션 순서: ${theme.sections.join(' → ')} 순으로 생성.
3. star_block은 경험마다 1개씩 생성 (최대 5개).
4. metric_cards의 before/after는 keyExperiences의 beforeMetric/afterMetric에서만 추출.
5. 개조식·두괄식 문장, 마크다운 기호(**,##) 사용 금지.
6. 각 visual_section id는 고유해야 한다.
7. 테마 톤에 맞게 어휘/강조점을 조정한다.

반드시 아래 JSON만 응답 (다른 설명 금지):
{
  "theme_id": "${themeId}",
  "theme_name": "${theme.name}",
  "visual_sections": [ ... ]
}`;
}


// ============================================================
// 경험 구성 계획 (composition plan)
//   기존 문제: 모든 경험이 고정된 7섹션 순서로 똑같이 조립돼
//   사용자·경험·지원 기업이 달라도 결과물 골격이 동일했다.
//   → AI가 "이 경험을, 이 기업에, 이 단계 지원자가" 어떻게 배치할지 설계도를 먼저 만든다.
//   실제 글 생성이 아니라 "무엇을 · 어떤 순서로 · 무엇을 빼고" 만 정한다.
// ============================================================


/**
 * 히어로 아티팩트 변형 — 경험 상세 상단에 깔리는 "그 직무다운 한 장".
 * 렌더러는 ProjectDetailModal의 JobArtifactCover에 이미 구현돼 있는데,
 * 지금까지 이 값을 세팅하는 곳이 손으로 만든 예시 데이터뿐이라
 * 실제 사용자는 전부 기본 변형만 보고 있었다. 구성 계획이 경험 성격에 맞춰 고른다.
 */
export const ARTIFACT_VARIANTS = {
  dev: [
    { id: 'code-diff', when: '코드 개선·리팩터링이 핵심일 때 (변경 전후 코드 비교)' },
    { id: 'quality-matrix', when: '테스트·품질 게이트·배포 안정성이 핵심일 때' },
    { id: 'performance-report', when: '성능 최적화 수치(응답시간·번들·렌더링)가 핵심일 때' },
    { id: 'accessibility-audit', when: '접근성·표준 준수 개선이 핵심일 때' },
    { id: 'automation-flow', when: '자동화·파이프라인·반복작업 제거가 핵심일 때' },
  ],
  pm: [
    { id: 'product-roadmap', when: '기간에 걸친 단계적 제품 개발이 핵심일 때' },
    { id: 'experiment-board', when: 'A/B 테스트·가설 검증 반복이 핵심일 때' },
    { id: 'discovery-map', when: '사용자 리서치·문제 발견 과정이 핵심일 때' },
    { id: 'service-blueprint', when: '서비스 흐름·터치포인트 설계가 핵심일 때' },
    { id: 'policy-system', when: '운영 정책·예외 규칙 설계가 핵심일 때' },
  ],
  marketer: [
    { id: 'launch-dashboard', when: '신제품 런칭 캠페인의 KPI·퍼널이 핵심일 때' },
    { id: 'crm-journey', when: 'CRM·리텐션·세그먼트별 여정 설계가 핵심일 때' },
    { id: 'content-scoreboard', when: '콘텐츠 제작·채널 운영 성과가 핵심일 때' },
    { id: 'paid-funnel', when: '유료 광고 퍼널·ROAS 최적화가 핵심일 때' },
    { id: 'growth-report', when: '그로스 실험·지표 개선 누적이 핵심일 때' },
  ],
};

/**
 * 데이터 주도 히어로 레시피 — 전용 변형(ARTIFACT_VARIANTS)이 없는 직군용.
 * 손으로 만든 dev/pm/marketer 변형 15종은 그대로 두고,
 * 나머지 직군은 기존 시각화 프리미티브(JobVisuals)를 조합해 경험마다 다른 히어로를 만든다.
 * 데이터가 없는 블록은 프론트에서 자동으로 빠지므로 빈 히어로가 생기지 않는다.
 */
export const ARTIFACT_BLOCKS = [
  { type: 'kpis', when: '대표 지표 2~4개를 타일로 (가장 무난한 시작 블록)', needs: '지표명+값' },
  { type: 'funnel', when: '단계별로 줄어드는 흐름 (지원→서류→면접, 노출→클릭→구매)', needs: '단계 2개 이상+수치' },
  { type: 'compare', when: '개선 전후 대비가 강점일 때', needs: 'before/after 쌍' },
  { type: 'process', when: '수행 절차·단계 설계가 강점일 때 (저니·파이프라인)', needs: '단계 2개 이상' },
  { type: 'mix', when: '비중 구성이 강점일 때 (채널·예산·시간 배분)', needs: '항목+비율%' },
  { type: 'goals', when: '목표 대비 달성 여부가 강점일 때', needs: '목표+실제' },
  { type: 'gauges', when: '목표치 대비 현재 수준 (가용성·SLA·달성률)', needs: '지표+현재값' },
];

/** 히어로 색 톤 — 임의 색상 대신 검증된 팔레트에서만 고르게 한다 (경험마다 다른 인상) */
export const ARTIFACT_TONES = ['navy', 'forest', 'ember', 'plum', 'slate'];

/** 구성 가능한 소스 블록 — 프론트 composeDraftBlocks가 이 key로 실제 내용을 찾아 넣는다. */
export const COMPOSABLE_SOURCES = [
  { key: 'product', label: '서비스 소개 (문제·해결·기능)' },
  { key: 'intro', label: '프로젝트 소개' },
  { key: 'overview', label: '프로젝트 개요·배경' },
  { key: 'task', label: '내가 맡은 과제' },
  { key: 'process', label: '진행 과정·의사결정' },
  { key: 'output', label: '결과물·성과' },
  { key: 'growth', label: '배운 점·관점 변화' },
  { key: 'competency', label: '발휘 역량·입사 후 기여' },
  { key: 'keyExperiences', label: '핵심 경험 카드 (직군별 단위)' },
  { key: 'decisionTrace', label: '판단 지도 (대안·선택 기준·바뀐 원칙)' },
  { key: 'evidenceBundle', label: '증거 자료 목록' },
  { key: 'honestReview', label: '솔직 회고 (막힌 지점·한계·다시 한다면)' },
  { key: 'voiceRecord', label: '사용자의 실제 말 인용' },
  { key: 'jobSpecific', label: '직군 특화 섹션 (기술스택·퍼널·리서치 등)' },
  { key: 'githubStats', label: 'GitHub 기여도 통계' },
  { key: 'leanCanvas', label: '린 캔버스' },
  { key: 'marketerKit', label: '마케터 캠페인 킷' },
  { key: 'portfolioVisuals', label: '지표 시각화 데이터' },
];

const NARRATIVE_TYPES = `
[서사 골격 — 이 경험에 가장 맞는 것 하나를 고르세요]
- problem-first : 문제 정의가 강렬할 때. 문제 → 접근 → 해결 → 결과 (기획·디자인·리서치형)
- outcome-first : 정량 성과가 뚜렷할 때. 성과 → 어떻게 → 근거 → 확장 (마케팅·세일즈·경력직)
- decision-first: 판단·트레이드오프가 핵심일 때. 결정 → 대안 → 기준 → 결과 (PM·아키텍처)
- process-first : 과정의 밀도가 강점일 때. 절차 → 각 단계 판단 → 산출물 (데이터·연구·인프라)
- build-first   : 만든 것 자체가 근거일 때. 제품 → 구조 → 구현 → 검증 (개발·AI/ML)
`;

/**
 * 경험 1건을 지원 기업/직무/경력단계에 맞춰 어떻게 구성할지 설계도를 만든다.
 * jobAnalysis가 없으면(기업 미지정) 경험 자체의 강점만으로 구성한다.
 */
export function buildExperienceCompositionPrompt({ experience, jobCategory, careerStage, jobAnalysis = null }) {
  const ja = jobAnalysis || {};
  const company = ja.company ? `${ja.company} / ${ja.position || ''}` : '';
  const skills = (ja.skills || []).slice(0, 12).join(', ');
  const weighted = (ja.skillImportance || []).slice(0, 8)
    .map(s => `${s.skill}(중요도 ${s.weight})`).join(', ');
  const comps = (ja.positionAnalysis?.keyCompetencies || []).slice(0, 6)
    .map(c => `${c.name}(${c.weight})`).join(', ');
  const essential = (ja.requirements?.essential || []).slice(0, 6).join(' / ');
  const preferred = (ja.requirements?.preferred || []).slice(0, 5).join(' / ');
  const values = (ja.coreValues || []).slice(0, 5).join(', ');
  const appeal = (ja.applicationStrategy?.appealPoints || []).slice(0, 4).join(' / ');
  const tips = (ja.applicationStrategy?.portfolioTips || []).slice(0, 4).join(' / ');
  const cautions = (ja.applicationStrategy?.cautionPoints || []).slice(0, 3).join(' / ');
  const variants = ARTIFACT_VARIANTS[jobCategory] || [];
  const hasVariants = variants.length > 0;
  const variantLines = hasVariants
    ? `${variants.map(v => `- ${v.id}: ${v.when}`).join('\n')}
→ 이 직군은 전용 변형이 있습니다. artifactVariant를 고르고 artifactRecipe는 null로 두세요.`
    : `이 직군은 전용 변형이 없습니다. artifactVariant는 빈 문자열로 두고, 대신 아래 블록을 조합해 artifactRecipe를 만드세요.
[조합 가능한 블록]
${ARTIFACT_BLOCKS.map(b => `- ${b.type}: ${b.when} (필요 데이터: ${b.needs})`).join('\n')}
[색 톤] ${ARTIFACT_TONES.join(' | ')} 중 하나. 경험의 성격에 맞는 인상을 고르세요
  (성과·매출=ember / 운영·안정성=forest / 분석·데이터=navy / 사람·조직=plum / 절차·문서=slate)
★ 블록은 2~3개. 첫 블록은 span="main"(넓게), 나머지는 "side".
★ 경험 데이터에 실제로 값이 있는 블록만 고르세요. 데이터가 없는 블록은 화면에서 자동으로 사라집니다.
★ title/kicker는 이 경험 고유의 문구로. "핵심 지표" 같은 일반 라벨 금지.`;

  const jobBlock = company ? `
[지원 대상 — 이 기업/직무에 맞춰 구성을 바꾸세요]
지원처: ${company}
필수 요건: ${essential || '(없음)'}
우대 요건: ${preferred || '(없음)'}
요구 스킬: ${skills || '(없음)'}
가중치 높은 스킬: ${weighted || '(없음)'}
핵심 역량(가중치): ${comps || '(없음)'}
인재상·핵심가치: ${values || '(없음)'}
어필 포인트: ${appeal || '(없음)'}
포트폴리오 팁: ${tips || '(없음)'}
주의 사항: ${cautions || '(없음)'}
` : `
[지원 대상 없음]
기업 분석 자료가 연결되지 않았습니다. 이 경험 자체의 강점이 가장 잘 드러나는 구성을 택하고,
jdAlignment는 빈 배열로 두세요.
`;

  return `당신은 채용 서류를 설계하는 포트폴리오 디렉터입니다.
아래 경험 1건을 "어떤 순서로, 무엇을 넣고, 무엇을 빼서" 보여줄지 **구성 설계도**만 만드세요.
글을 새로 쓰는 것이 아닙니다. 이미 있는 내용을 어떻게 배치할지만 결정합니다.

⛔ 가장 중요한 규칙: 모든 경험에 같은 구성을 쓰지 마세요.
   이 경험의 강점이 무엇이냐에 따라, 그리고 지원처가 무엇을 보느냐에 따라 골격과 섹션 제목이 달라져야 합니다.
   기본 7섹션(소개·개요·과제·과정·결과·성장·역량)을 그대로 나열하는 것은 실패한 구성입니다.

직군: ${jobCategory || 'common'}
지원 단계: ${careerStage || 'first'} (first=첫 취업 / newgrad=신입 / experienced=경력 이직)
${jobBlock}
${NARRATIVE_TYPES}

[히어로 아티팩트 — 경험 상세 맨 위에 깔리는 "그 직무다운 한 장"]
${variantLines}
★ 경험의 성격에 맞는 것을 고르세요. 같은 직군이어도 경험마다 달라야 합니다.
  예: 마케터라도 신제품 런칭이면 launch-dashboard, 휴면고객 리텐션이면 crm-journey.
  기본값을 습관적으로 고르지 마세요.

[사용 가능한 소스 블록 — sections[].source는 반드시 이 key 중 하나]
${COMPOSABLE_SOURCES.map(s => `- ${s.key}: ${s.label}`).join('\n')}

[구성 규칙]
1. sections는 4~7개. 많을수록 좋은 게 아닙니다. 근거가 약한 블록은 과감히 빼고 omitted에 이유를 쓰세요.
2. title은 이 경험에 맞는 고유한 제목이어야 합니다. ("프로젝트 개요" 같은 기본 라벨 재사용 금지)
   ✅ 좋은 예: "왜 색 대비가 아니라 문구였나", "1,200만원으로 만든 첫 달 매출", "금요일 밤의 502"
   ❌ 나쁜 예: "프로젝트 소개", "진행한 일", "결과물"
3. 지원처가 있으면 필수 요건·가중치 높은 스킬을 증명하는 블록을 앞쪽에 배치하세요.
   요구사항과 무관한 블록은 뒤로 보내거나 뺍니다.
4. 경력 단계 반영: first는 판단 과정과 솔직 회고를 앞세우고, experienced는 성과·오너십·의사결정을 앞세웁니다.
5. honestReview는 마지막 근처에 두되 빼지 마세요. 지원처 주의사항에 "과장 경계"류가 있으면 더 앞으로 올립니다.
6. 근거가 없는 소스는 넣지 마세요. 경험 데이터에 값이 비어 있는 블록을 배치하면 빈 섹션이 됩니다.

경험 데이터(요약):
${JSON.stringify(experience).slice(0, 6000)}

아래 JSON으로만 응답 (마크다운 없이 순수 JSON):
{
  "narrative": "problem-first|outcome-first|decision-first|process-first|build-first",
  "narrativeReason": "이 골격을 고른 이유 1문장",
  "artifactVariant": "전용 변형이 있는 직군일 때만 그 id, 아니면 빈 문자열",
  "artifactRecipe": null,
  "artifactReason": "이 히어로를 고른/구성한 이유 1문장",
  "headline": "이 경험을 한 줄로 세우는 문장 (지원처가 있으면 그 직무 언어로)",
  "sections": [
    {
      "source": "위 key 중 하나",
      "title": "이 경험에 맞는 고유한 섹션 제목",
      "emphasis": "high|normal",
      "why": "이 위치에 이 블록을 둔 이유 (지원처가 있으면 어떤 요건과 연결되는지)"
    }
  ],
  "keyExperienceOrder": [0, 1, 2],
  "keyExperienceReason": "첫 번째로 올린 핵심 경험을 그렇게 고른 이유",
  "omitted": [ { "source": "뺀 key", "reason": "뺀 이유" } ],
  "jdAlignment": [
    { "requirement": "공고의 요구사항", "coveredBy": "이를 증명하는 섹션 제목 또는 핵심 경험", "strength": "strong|weak|missing", "note": "weak/missing이면 무엇을 보강해야 하는지" }
  ]
}

artifactRecipe는 전용 변형이 없는 직군일 때만 아래 형태로 채우세요 (변형이 있는 직군이면 null):
{ "kicker": "짧은 영문 라벨", "title": "이 경험 고유의 히어로 제목", "badge": "선택 배지(없으면 빈 문자열)",
  "tone": "navy|forest|ember|plum|slate",
  "blocks": [ { "type": "kpis|funnel|compare|process|mix|goals|gauges", "title": "블록 제목", "span": "main|side" } ] }

keyExperienceOrder는 경험 데이터의 keyExperiences 배열 인덱스입니다. 지원처 요건과 가장 관련 있는 것을 앞으로 보내세요.
jdAlignment에는 missing도 정직하게 남기세요. 다 strong으로 채우면 사용자가 무엇을 보완할지 알 수 없습니다.`;
}
