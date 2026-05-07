// Gemini 2.5 Pro 호출하여 슬라이드별 텍스트 박스에 들어갈 콘텐츠를 매핑.
// 노션형 포트폴리오 데이터의 모든 섹션이 누락 없이 슬라이드에 분배되도록 사전에
// planDeck 단계에서 슬라이드 수를 조정한다(부족하면 복제).

import { generateWithRetry, callProFirst, parseJSON } from './geminiService.js';
import { estimateMaxChars } from './autofit.js';

// ── 1) 노션형 포트폴리오에서 PPT에 들어갈 섹션 정규화 ──────────────────────
function normalizePortfolio(p) {
  return {
    about: {
      name: p.userName || '',
      headline: p.headline || '',
      essay: p.valuesEssay || '',
      values: p.values || [],
      goals: p.goals || [],
    },
    skills: p.skills || {},
    experiences: Array.isArray(p.experiences) ? p.experiences : [],
    education: Array.isArray(p.education) ? p.education : [],
    awards: Array.isArray(p.awards) ? p.awards : [],
    interests: p.interests || [],
    contact: p.contact || {},
    targetCompany: p.targetCompany || '',
    targetPosition: p.targetPosition || '',
    title: p.title || '포트폴리오',
  };
}

// ── 2) 사전 계획: 어떤 슬라이드가 어떤 섹션을 맡을지 ─────────────────────
// 템플릿 슬라이드를 순서대로 [표지, 자기소개, 스킬, 프로젝트(N개), 경력, 수상, 연락처]에 매핑.
// 슬라이드 수가 부족하면 마지막 콘텐츠 슬라이드를 복제해 채운다.
export function planDeck(layout, portfolio) {
  const norm = normalizePortfolio(portfolio);
  const projects = norm.experiences;
  const desired = ['cover', 'about', 'skills'];
  for (let i = 0; i < projects.length; i++) desired.push(`project:${i}`);
  if (norm.education.length) desired.push('education');
  if (norm.awards.length) desired.push('awards');
  desired.push('contact');

  const tplCount = layout.slides.length;
  const plan = [];
  for (let i = 0; i < desired.length; i++) {
    // 템플릿 슬라이드가 모자라면 가장 가까운 콘텐츠 슬라이드(인덱스 1 이후)를 순환 사용.
    const templateIdx = i < tplCount ? i : 1 + ((i - 1) % Math.max(1, tplCount - 1));
    plan.push({
      planIndex: i,
      templateSlideIndex: templateIdx,
      sectionType: desired[i].split(':')[0],
      sectionParam: desired[i].split(':')[1] || null,
    });
  }
  return { norm, plan };
}

// ── 3) AI에 넘길 슬라이드별 박스 스펙 ────────────────────────────────────
function buildSlotsSpec(layout, plan) {
  return plan.map(step => {
    const tpl = layout.slides[step.templateSlideIndex];
    const slots = tpl.textBoxes.map(box => ({
      shapeId: `${step.planIndex}::${box.shapeId}`,
      role: box.role,
      width: Math.round(box.w),
      height: Math.round(box.h),
      basePt: Math.round(box.fontPt),
      maxChars: estimateMaxChars({ boxWidthPt: box.w, boxHeightPt: box.h, basePt: box.fontPt }),
    }));
    return {
      slideIndex: step.planIndex,
      sectionType: step.sectionType,
      sectionParam: step.sectionParam,
      slots,
    };
  });
}

// ── 4) 시스템 프롬프트 ───────────────────────────────────────────────────
function buildSystemPrompt() {
  return `당신은 "FitPoly Deck Mapper"라는 PPT 생성 엔진의 콘텐츠 매핑 모듈입니다.
입력으로 (A) 사용자의 노션형 포트폴리오 데이터(JSON), (B) PPT 템플릿에서
추출된 슬라이드별 텍스트 박스 레이아웃(JSON), (C) 슬라이드 계획이 주어집니다.
당신의 임무는 각 슬라이드의 모든 텍스트 박스(shapeId)에 들어갈 한국어
텍스트를 결정하는 것입니다.

[절대 규칙]
1. 노션 포트폴리오의 모든 섹션(자기소개/스킬/프로젝트/경력/연락처/수상 등)을
   하나도 누락하지 마십시오. 슬라이드는 미리 분배되어 있습니다 — 당신은 주어진
   슬라이드만 채우면 됩니다.
2. 각 박스에는 maxChars(글자 수 한도)가 명시됩니다. 절대 초과 금지.
   초과 위험 시 "정보 압축"이 아니라 "정보 선택"으로 해결하십시오 —
   덜 중요한 정보를 통째로 빼되, 남기는 표현은 또렷하고 단정하게.
3. 출력은 반드시 지정된 JSON 스키마. 그 외 텍스트 금지.

[프로젝트 슬라이드 — 가장 중요]
프로젝트 슬라이드는 다음 4개 슬롯 구조로 강제 매핑됩니다.
박스 role 또는 위치(상단=title, 좌측=problem/role, 우측=result/metric)를
바탕으로 분배하십시오.

  · problem  — 문제 정의/배경. "무엇이 왜 문제였는지" 한두 문장. 서술형.
  · role     — 본인의 역할과 핵심 행동. 동사 위주 bullet 2~3개.
               "내가 무엇을 결정하고 무엇을 만들었는가"가 드러나도록.
  · result   — 정성적 성과. "어떤 변화/임팩트를 만들었는가". 1~2 bullet.
  · metric   — **숫자 지표**. 가장 짧고 굵은 키워드 1~2개.
               예: "응답속도 -150ms", "전환율 +12%", "MAU 3.2K → 11K".
               지표가 데이터에 없으면 추정/창작 금지. 객관 사실(예: "팀 4명, 6주")로
               대체. "약" "대략" 금지.

지표 추출 가이드:
  · "150ms 단축", "20% 상승", "10만 다운로드", "MAU 3.2K" 같은 표현을
    포트폴리오 본문에서 직접 발굴할 것.
  · 화살표(→, -, +)와 단위만 남기고 군더더기 제거.
    "사용자 만족도 70%에서 92%로 상승" → "만족도 70% → 92%".
  · metric 슬롯이 여러 개면 각각 다른 지표 분배. 같은 지표 반복 금지.
  · metric 박스(짧고 큰 박스)에는 emphasis="metric"을 반드시 표기.

[다른 섹션 매핑]
  · cover     — 큰 제목 박스에는 사용자 이름 또는 portfolio.title.
                보조 박스에는 targetCompany / targetPosition.
  · about     — 가치관·강점을 1~2 문장. 자기 PR 톤. 미사여구 X.
  · skills    — 카테고리당 3~6개. 레벨 표기 금지(별/% X). 단어만.
                bullet은 박스가 여러 개면 분산, 한 박스면 줄바꿈으로.
  · education — 학교·전공·기간을 한 줄. 핵심만.
  · awards    — 상명·기관·연도. 한 줄.
  · contact   — 이메일/링크만. 전화번호·주소 X.

[금지]
  · maxChars 초과
  · 존댓말 "~합니다", "~했습니다" (PPT는 단정형/명사형)
  · 이모지, 영어와 한글의 무분별한 혼용 (영문 고유명사는 허용)
  · 데이터에 없는 사실/회사명/숫자의 창작

[출력 스키마]
{
  "slides": [
    {
      "slideIndex": <number>,
      "sectionType": "<string>",
      "slots": [
        {
          "shapeId": "<string, 입력과 동일>",
          "text": "<string, maxChars 이하>",
          "emphasis": "<none|metric|title>"
        }
      ]
    }
  ]
}`;
}

// ── 5) 프롬프트 빌드 ────────────────────────────────────────────────────
function buildUserPrompt(norm, slotsSpec) {
  return [
    '## 포트폴리오 데이터(JSON)',
    JSON.stringify(norm, null, 2),
    '',
    '## 슬라이드 계획 + 박스 사양(JSON)',
    JSON.stringify(slotsSpec, null, 2),
    '',
    '위 데이터를 출력 스키마에 맞게 JSON만으로 반환하시오.',
  ].join('\n');
}

// ── 6) 메인 매핑 함수 ────────────────────────────────────────────────────
export async function mapDeck({ portfolio, layout }) {
  const { norm, plan } = planDeck(layout, portfolio);
  const slotsSpec = buildSlotsSpec(layout, plan);

  const prompt = `${buildSystemPrompt()}\n\n${buildUserPrompt(norm, slotsSpec)}`;
  const text = await callProFirst(prompt, 'PPT-Mapper');
  const parsed = parseJSON(text);

  const bySlide = new Map();
  for (const s of (parsed.slides || [])) bySlide.set(s.slideIndex, s);

  // AI 응답을 plan/layout과 합쳐 렌더 가능한 deck 으로 변환
  return plan.map(step => {
    const tpl = layout.slides[step.templateSlideIndex];
    const ai = bySlide.get(step.planIndex) || { slots: [] };
    const slotMap = new Map();
    for (const s of (ai.slots || [])) slotMap.set(s.shapeId, s);
    return {
      planIndex: step.planIndex,
      sectionType: step.sectionType,
      templateSlideIndex: step.templateSlideIndex,
      boxes: tpl.textBoxes.map(box => {
        const key = `${step.planIndex}::${box.shapeId}`;
        const ai = slotMap.get(key);
        return {
          ...box,
          text: (ai?.text || '').trim(),
          emphasis: ai?.emphasis || 'none',
        };
      }),
    };
  });
}
