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
2) 사용자의 노션형 포트폴리오 데이터를 "합격자 포트폴리오" 형태로 재구성하여 삽입한다 (개조식·두괄식·결과 중심).
3) 데이터 누락 금지: 모든 섹션을 반영하되, 특히 다음 두 가지는 반드시 돋보이게 포함한다.
   ① 성과 지표(정량 수치·데이터 시각화 요소 — %, 시간, 인원, 매출, before/after) → key_metrics + projects[*].metrics 에 빠짐없이.
   ② 핵심경험 & 성과(STAR: problem · action · result) → projects[*].problem / action[] / result[] 에 풍성하게.
   이 두 항목은 발표 가치가 가장 높으므로, 약하면 다른 사족을 줄여서라도 분량을 확보한다.
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
2. 각 프로젝트/경험은 **문제정의 → 과제 → 행동(3~5개) → 결과(2~4개) → 배운점** 구조로 풍성하게 요약. 한 줄로 끝내지 않음.
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
      "tech_stack": ["React", "TypeScript", "Node.js", "Redis", "PostgreSQL"],
      "problem": "구체적 문제 1줄 (≤40자, 정량 맥락 포함)",
      "situation": "사업·팀 맥락 1줄",
      "task": "내가 해결할 과제 1줄",
      "action": ["기술 X 적용해 Y 구축 (≤30자)", "...", "..."],
      "result": ["P95 응답 -42%", "전환율 +18%", "..."],
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
- highlight_metric { label, value, before, after } : 절대 임의 변경 금지(원본 그대로)

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
  return `당신은 합격자 포트폴리오 PPT 컨설턴트입니다. 아래 포트폴리오 데이터를 분석해
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
