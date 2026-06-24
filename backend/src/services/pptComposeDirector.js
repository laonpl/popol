// PPT 추출 "구성 디렉터" — 사용자가 흐름/디자인/표지/컬러 칸에 적은 요청 텍스트를
// 실제 컴포저 옵션(structure/design/cover/tone/accentHex/emphasis)으로 번역한다.
//
// 2단계: ① 결정론적 키워드 매핑(항상, 무료·즉시) → ② 요청이 있고 API 가 살아 있으면
// AI 로 보강(임의 표현·뉘앙스 반영). 둘 다 enum/hex 화이트리스트로 검증하므로
// 잘못된 값은 무시되고 드롭다운 선택값으로 안전하게 폴백한다.
import { generateWithRetry, parseJSON } from './geminiService.js';

const STRUCTURES = ['story', 'metrics', 'compact', 'detailed'];
const DESIGNS = ['editorial', 'cards', 'timeline'];
const COVERS = ['impact', 'profile', 'split', 'banner'];
const TONES = ['calm', 'vivid', 'mono'];
const HEADER_STYLES = ['underline', 'block', 'sidebar'];
const ACCENT_BARS = ['left', 'top', 'none'];
const CLOSINGS = ['dark', 'light', 'accent'];
const CARD_STYLES = ['pill', 'bar', 'numbered'];
// 프로젝트 슬라이드의 "페이지 골격"(배치) — design(본문 위젯)과 별개의 축.
//  stack=상단 헤더+아래 본문 / rail=좌측 컬러 패널(제목·메타)+우측 본문 / split=좌 본문+우 성과 패널
const PROJECT_LAYOUTS = ['stack', 'rail', 'split'];

// 완성형 프리셋 — 6개가 (흐름 × 배치)부터 표지·톤·헤더·악센트바·마무리·카드스타일까지
// 전부 달라 확연히 다른 덱이 된다. 핵심: 같은 design(cards)을 써도 structure(흐름)·
// cardStyle 이 달라 본문 구성·카드 모양이 서로 다르게 보인다.
//  - structure 가 슬라이드 순서/장수/항목 구성을 바꾸고(compact=1장압축, metrics=성과선행,
//    detailed=5단+성과분리, story=서사 4단), design 이 본문 배치(행/카드/타임라인)를 바꾼다.
const PRESETS = {
  // 미니멀 문서 — 프로젝트당 1장 압축(좌 본문+우 지표) + 문서형 문단 + 밝은 마무리
  minimal:  { structure: 'compact',  design: 'editorial', cover: 'impact',  tone: 'mono',  headerStyle: 'underline', accentBar: 'none', closing: 'light',  cardStyle: 'pill',     projectLayout: 'stack' },
  // 모던 카드 — 상단 헤더 + 알약 카드 그리드(서사 4단)
  cards:    { structure: 'story',    design: 'cards',     cover: 'profile', tone: 'calm',  headerStyle: 'block',     accentBar: 'top',  closing: 'dark',   cardStyle: 'pill',     projectLayout: 'stack' },
  // 타임라인 스토리 — 세로 단계 노드 + 사이드바 헤더 + 좌측 컬러 표지
  timeline: { structure: 'story',    design: 'timeline',  cover: 'split',   tone: 'calm',  headerStyle: 'sidebar',   accentBar: 'left', closing: 'dark',   cardStyle: 'pill',     projectLayout: 'stack' },
  // 데이터 리포트 — 좌 접근/배경 본문 + 우측 성과 대시보드 패널(한 장에 narrative+지표)
  data:     { structure: 'metrics',  design: 'cards',     cover: 'profile', tone: 'vivid', headerStyle: 'block',     accentBar: 'left', closing: 'accent', cardStyle: 'bar',      projectLayout: 'split' },
  // 임팩트 매거진 — 좌측 컬러 제목 패널(레일) + 우측 5단 넘버링 카드 + 강렬
  magazine: { structure: 'detailed', design: 'cards',     cover: 'banner',  tone: 'vivid', headerStyle: 'block',     accentBar: 'top',  closing: 'accent', cardStyle: 'numbered', projectLayout: 'rail'  },
  // 상세 아카이브 — 과정 5단 상세 + 문서형 행 + 절제된 톤
  archive:  { structure: 'detailed', design: 'editorial', cover: 'profile', tone: 'calm',  headerStyle: 'underline', accentBar: 'left', closing: 'dark',   cardStyle: 'pill',     projectLayout: 'stack' },
};

// 한/영 색 이름 → hex
const COLOR_MAP = [
  [/빨강|레드|적색|red/i, '#DC2626'],
  [/주황|오렌지|orange/i, '#EA580C'],
  [/노랑|옐로|yellow|골드|금색|gold/i, '#CA8A04'],
  [/연두|라임|lime/i, '#65A30D'],
  [/초록|녹색|그린|green/i, '#16A34A'],
  [/청록|민트|틸|teal|mint/i, '#0D9488'],
  [/하늘|스카이|sky|cyan|시안/i, '#0284C7'],
  [/남색|네이비|navy/i, '#1E3A8A'],
  [/파랑|블루|blue|청색/i, '#2563EB'],
  [/보라|퍼플|purple|violet|바이올렛/i, '#7C3AED'],
  [/분홍|핑크|pink/i, '#DB2777'],
  [/자주|마젠타|magenta/i, '#BE185D'],
  [/갈색|브라운|brown/i, '#92400E'],
  [/검정|블랙|black|먹/i, '#111827'],
  [/회색|그레이|gray|grey|무채색/i, '#4B5563'],
];

function parseColor(text) {
  if (!text) return '';
  const hex = String(text).match(/#([0-9a-fA-F]{6})\b/);
  if (hex) return `#${hex[1].toUpperCase()}`;
  for (const [re, val] of COLOR_MAP) if (re.test(text)) return val;
  return '';
}

const inEnum = (v, list, fb) => (typeof v === 'string' && list.includes(v.trim()) ? v.trim() : fb);
const validHex = (v) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '').trim()) ? String(v).trim().toUpperCase() : '');

// ── Q&A(클로드식 질의응답) → 구성 매핑 ──────────────────────────────────
// 업로드 템플릿 + 5개 질문(대상·발표시간·톤·색상·강조점) 답을 받아 고객마다 다른
// 덱이 되도록 composer 옵션을 만든다. 프리셋과 달리 "발표 맥락"에서 구성을 도출한다.
const AUDIENCES = ['campus', 'corporate', 'startup', 'client'];
const DURATIONS = ['short', 'medium', 'long'];
const QA_TONES = ['professional', 'minimal', 'friendly', 'bold'];
const QA_COLORS = ['auto', 'mono', 'brand', 'warm', 'cool']; // auto = 템플릿 추출 강조색 그대로

// 발표 시간 → 흐름(장수·서술 밀도)
const DURATION_STRUCTURE = { short: 'compact', medium: 'story', long: 'detailed' };
// 톤 → 본문 배치·표지·헤더 등 "룩" 한 벌
const TONE_LOOK = {
  professional: { design: 'cards',     cover: 'profile', tone: 'calm',  headerStyle: 'block',     accentBar: 'left', closing: 'dark',   cardStyle: 'bar'      },
  minimal:      { design: 'editorial', cover: 'impact',  tone: 'calm',  headerStyle: 'underline', accentBar: 'none', closing: 'light',  cardStyle: 'pill'     },
  friendly:     { design: 'cards',     cover: 'banner',  tone: 'calm',  headerStyle: 'block',     accentBar: 'top',  closing: 'light',  cardStyle: 'pill'     },
  bold:         { design: 'cards',     cover: 'impact',  tone: 'vivid', headerStyle: 'block',     accentBar: 'top',  closing: 'accent', cardStyle: 'numbered' },
};
const COLOR_ACCENT = { warm: '#EA580C', cool: '#2563EB' };

// 발표 대상 → 프로젝트 슬라이드 "페이지 골격"(본문 블록 위치). 시간(흐름)·톤(스타일)과
// 별개 축이라, 같은 시간·톤이라도 대상이 다르면 내용이 놓이는 구도 자체가 달라진다.
//  stack=상단 헤더+아래 본문(정석) / rail=좌측 컬러 제목 패널+우 본문(눈에 띄는 매거진형)
//  / split=좌 본문+우 성과 대시보드 패널(지표·결과를 옆에 크게)
// ※ structure=compact(발표 ~3분)는 자체 1장 골격이라 이 값과 무관하게 압축 배치된다.
const AUDIENCE_LAYOUT = {
  campus:    'rail',   // 교내·공모전 — 심사위원 눈길 끄는 매거진형
  corporate: 'stack',  // 기업 면접 — 위에서 아래로 읽는 깔끔한 정석
  startup:   'split',  // 투자·IR — 성과·지표를 옆에 대시보드로
  client:    'split',  // 고객·제안 — 가치·결과를 옆 패널로 부각
};

function qaToComposition(qa = {}) {
  const toneKey = inEnum(qa.tone, QA_TONES, 'professional');
  const look = TONE_LOOK[toneKey];
  const structure = DURATION_STRUCTURE[inEnum(qa.duration, DURATIONS, 'medium')];
  const projectLayout = AUDIENCE_LAYOUT[inEnum(qa.audience, AUDIENCES, '')] || '';

  // 색상: 흑백 → mono 톤 / 브랜드 → hex / 따뜻·차분 → 대표 hex / 자유 입력 → 색이름 파싱
  const colorKey = inEnum(qa.color, QA_COLORS, '');
  let toneTok = look.tone;
  let accentHex = '';
  if (colorKey === 'mono') toneTok = 'mono';
  else if (colorKey === 'brand') accentHex = validHex(qa.brandHex);
  else if (COLOR_ACCENT[colorKey]) accentHex = COLOR_ACCENT[colorKey];
  if (!accentHex && colorKey !== 'mono') {
    const parsed = parseColor(qa.brandHex || qa.color);
    if (parsed) accentHex = parsed;
  }

  return {
    structure,
    design: look.design,
    cover: look.cover,
    tone: toneTok,
    accentHex: accentHex || '',
    emphasis: typeof qa.emphasis === 'string' ? qa.emphasis.slice(0, 80) : '',
    headerStyle: look.headerStyle,
    accentBar: look.accentBar,
    closing: look.closing,
    cardStyle: look.cardStyle,
    projectLayout, // 대상별 골격(빈값이면 컴포저가 structure/design 으로부터 추론)
    preset: '',
  };
}

const AUDIENCE_LABEL = {
  campus: '교내·공모전 심사위원', corporate: '기업 면접관·채용 담당자',
  startup: '투자자·IR 청중', client: '고객·제안 대상자',
};

function buildEmphasisPrompt(qa, portfolio) {
  const ctx = [portfolio?.userName, portfolio?.headline, portfolio?.targetPosition].filter(Boolean).join(' / ');
  return `포트폴리오 발표 PPT의 표지와 마무리 장에 넣을 강렬한 한 줄 슬로건을 한국어로 딱 1개만 만드세요.
[지원자] ${ctx || '정보 없음'}
[발표 대상] ${AUDIENCE_LABEL[qa.audience] || qa.audience || '일반'}
[강조하고 싶은 점] ${qa.emphasis || '(지정 없음 — 지원자 강점으로)'}
[규칙] 30자 이내, 명사형/체언 종결, 따옴표·이모지·마침표 금지, 한 줄만.
[출력] 슬로건 텍스트만 출력(설명·JSON 금지).`;
}

// 강조점 + 발표 대상을 표지/마무리용 한 줄 슬로건으로 다듬는다(선택·AI, 실패 시 원문 유지).
async function refineEmphasis(qa, portfolio) {
  const hasInput = (qa.emphasis && qa.emphasis.trim()) || qa.audience;
  if (!hasInput) return '';
  try {
    const text = await generateWithRetry(buildEmphasisPrompt(qa, portfolio), {
      models: ['gemini-2.5-flash-lite'],
      retries: 1, delayMs: 600, rateLimitDelayMs: 2000, callTimeoutMs: 15000, githubFallback: false,
    });
    const line = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0] || '';
    return line.replace(/^["'`「『]+|["'`」』]+$/g, '').replace(/[.。]$/, '').slice(0, 40);
  } catch (err) {
    console.warn('[refineEmphasis] AI 슬로건 생략 (원문 유지):', err.message);
    return '';
  }
}

// 결정론적 키워드 매핑 — 요청 텍스트에서 옵션 추론
function keywordOverride(base, requests) {
  const out = { ...base };
  const { flow = '', design = '', cover = '', color = '' } = requests;

  if (/성과|실적|숫자|지표|수치|impact|먼저|앞에/i.test(flow)) out.structure = 'metrics';
  else if (/요약|짧게|간단|한 ?장|압축|compact|핵심만/i.test(flow)) out.structure = 'compact';
  else if (/자세|상세|구체|detail|길게|풍부/i.test(flow)) out.structure = 'detailed';
  else if (/스토리|서사|이야기|흐름|story/i.test(flow)) out.structure = 'story';

  if (/카드|박스|그리드|card|grid|나눠|분할(?!형)/i.test(design)) out.design = 'cards';
  else if (/타임라인|시간순|연대|흐름도|단계|timeline|여정/i.test(design)) out.design = 'timeline';
  else if (/문서|깔끔|심플|미니멀|기본|editorial|clean/i.test(design)) out.design = 'editorial';

  // 페이지 골격(배치) — 본문 위젯과 별개로 슬라이드 전체 구도를 바꾼다
  if (/레일|좌측 ?패널|사이드 ?패널|왼쪽 ?패널|세로 ?제목|제목 ?옆/i.test(design)) out.projectLayout = 'rail';
  else if (/좌우|반반|투 ?컬럼|two ?column|좌 ?본문|성과 ?옆|한 ?장에 ?같이/i.test(`${flow} ${design}`)) out.projectLayout = 'split';
  else if (/상단 ?헤더|위에 ?제목|기본 ?배치|stack/i.test(design)) out.projectLayout = 'stack';

  if (/배너|밴드|가로 ?띠|상단 ?컬러|banner/i.test(cover)) out.cover = 'banner';
  else if (/임팩트|크게|대문짝|강렬|큰 ?이름|impact|시원/i.test(cover)) out.cover = 'impact';
  else if (/프로필|정보|카드|요약|스펙|profile/i.test(cover)) out.cover = 'profile';
  else if (/분할|반반|투톤|패널|좌우|split|두 ?영역/i.test(cover)) out.cover = 'split';

  if (/강렬|쨍|선명|확실|진하게|vivid|채워|가득/i.test(color)) out.tone = 'vivid';
  else if (/흑백|모노|무채색|블랙앤화이트|mono|단색/i.test(color)) out.tone = 'mono';
  else if (/차분|은은|절제|연하게|부드럽|calm|잔잔/i.test(color)) out.tone = 'calm';

  const hex = parseColor(color);
  if (hex) out.accentHex = hex;

  // 골격 정체성 — 디자인/색 요청에서 헤더 스타일·악센트 바·마무리 장을 추론
  if (/박스|블록|굵|대담|매거진|block/i.test(design)) out.headerStyle = 'block';
  else if (/사이드|측면|좌측 ?탭|sidebar/i.test(design)) out.headerStyle = 'sidebar';
  else if (/밑줄|언더라인|심플 ?헤더|underline/i.test(design)) out.headerStyle = 'underline';

  if (/상단 ?바|윗줄|위쪽 ?(줄|바)|top ?bar/i.test(design)) out.accentBar = 'top';
  else if (/(바|줄|선) ?(없|빼|제거)|깔끔|미니멀|여백/i.test(design)) out.accentBar = 'none';
  else if (/좌측 ?바|왼쪽 ?(줄|바)|side ?bar|left ?bar/i.test(design)) out.accentBar = 'left';

  const endHint = `${cover} ${color}`;
  if (/마무리|엔딩|끝 ?장|클로징|closing/i.test(endHint)) {
    if (/강렬|컬러|포인트|채워|vivid|accent/i.test(endHint)) out.closing = 'accent';
    else if (/밝|화이트|light|흰/i.test(endHint)) out.closing = 'light';
    else if (/어둡|다크|블랙|dark|검/i.test(endHint)) out.closing = 'dark';
  }
  return out;
}

function buildPrompt(base, requests, portfolio) {
  const ctx = [portfolio?.userName, portfolio?.headline, portfolio?.targetPosition].filter(Boolean).join(' / ');
  return `당신은 포트폴리오 PPT 아트디렉터입니다. 지원자가 4개 항목에 적은 요청을 읽고,
아래 허용된 값 중에서만 골라 구성 설정 JSON 을 만드세요. 요청이 비었거나 모호하면 현재값을 유지합니다.

[지원자] ${ctx || '정보 없음'}

[현재 설정] structure=${base.structure}, design=${base.design}, cover=${base.cover}, tone=${base.tone}, headerStyle=${base.headerStyle || '(design 기본)'}, accentBar=${base.accentBar}, closing=${base.closing}

[사용자 요청]
- 흐름(slide 순서/분량): "${requests.flow || ''}"
- 디자인(본문 배치): "${requests.design || ''}"
- 표지: "${requests.cover || ''}"
- 포인트 컬러: "${requests.color || ''}"

[허용 값과 의미]
- structure: story(문제→해결 서사) | metrics(성과·지표를 앞에) | compact(프로젝트당 1장 요약) | detailed(과정+성과 2장씩 상세)
- design: editorial(라벨+문단 행 쌓기) | cards(문제/해결/성과 가로 카드) | timeline(세로 단계 타임라인)
- projectLayout(프로젝트 슬라이드 골격): stack(상단 헤더+아래 본문) | rail(좌측 컬러 패널에 제목·메타, 우측 본문) | split(좌 본문+우 성과 대시보드). 근거 없으면 빈문자열.
- cover: impact(큰 이름·카피) | profile(우측 정보 카드) | split(좌측 컬러 패널) | banner(상단 컬러 밴드)
- tone: calm(절제) | vivid(포인트 컬러 가득) | mono(흑백)
- headerStyle: underline(밑줄 헤더) | block(컬러 블록 헤더, 대담) | sidebar(좌측 컬러 탭 헤더). 요청 근거 없으면 빈문자열로 두어 현재값 유지.
- accentBar: left(좌측 세로 바) | top(상단 가로 바) | none(바 없이 깔끔)
- closing: dark(다크 배경 마무리) | light(밝은 마무리) | accent(포인트 컬러 가득 마무리)

[출력 — JSON 만, 다른 말 금지]
{"structure":"","design":"","projectLayout":"","cover":"","tone":"","headerStyle":"","accentBar":"","closing":"","accentHex":"#RRGGBB 또는 빈문자열","emphasis":"표지·마무리에 넣을 한 줄(요청에 근거할 때만, 없으면 빈문자열, 40자 이내)"}`;
}

// 최종 구성 해석. qa=클로드식 질의응답(우선), choices=프리셋/드롭다운, requests=자유 입력.
export async function resolveComposition({ portfolio, choices = {}, requests = {}, qa = null }) {
  // Q&A 경로 — 5개 답을 발표 맥락 기반 구성으로 변환하고, 강조점은 슬로건으로 다듬는다.
  if (qa && typeof qa === 'object') {
    const base = qaToComposition(qa);
    const slogan = await refineEmphasis(qa, portfolio);
    if (slogan) base.emphasis = slogan;
    return base;
  }

  // 프리셋이 있으면 4축 기본값과 골격 정체성(헤더·악센트 바·마무리)을 공급한다.
  const preset = PRESETS[String(choices.preset || '').trim()] || null;
  const dflt = preset || { structure: 'story', design: 'editorial', cover: 'impact', tone: 'calm' };
  // 정체성 knob 도 base 에 포함 — 프리셋이 기본을 잡되 요청/AI 가 덮어쓸 수 있다.
  const base = {
    structure: inEnum(choices.structure, STRUCTURES, dflt.structure),
    design: inEnum(choices.design, DESIGNS, dflt.design),
    cover: inEnum(choices.cover, COVERS, dflt.cover),
    tone: inEnum(choices.tone, TONES, dflt.tone),
    accentHex: validHex(choices.accentHex) || (preset?.accentHex || ''),
    emphasis: typeof choices.emphasis === 'string' ? choices.emphasis.slice(0, 80) : '',
    headerStyle: inEnum(choices.headerStyle, HEADER_STYLES, preset?.headerStyle || ''),
    accentBar: inEnum(choices.accentBar, ACCENT_BARS, preset?.accentBar || 'left'),
    closing: inEnum(choices.closing, CLOSINGS, preset?.closing || 'dark'),
    cardStyle: inEnum(choices.cardStyle, CARD_STYLES, preset?.cardStyle || 'pill'),
    // 빈문자열이면 컴포저가 structure/design 으로부터 골격을 추론한다
    projectLayout: inEnum(choices.projectLayout, PROJECT_LAYOUTS, preset?.projectLayout || ''),
    preset: preset ? String(choices.preset).trim() : '',
  };

  const reqText = ['flow', 'design', 'cover', 'color'].map(k => requests[k] || '').join('').trim();
  if (!reqText) return base;

  // ① 결정론적 매핑 (항상)
  let cfg = keywordOverride(base, requests);

  // ② AI 보강 (요청이 있을 때만, 실패해도 ① 결과 유지)
  try {
    const text = await generateWithRetry(buildPrompt(base, requests, portfolio), {
      models: ['gemini-2.5-flash-lite'],
      retries: 1, delayMs: 800, rateLimitDelayMs: 2000, callTimeoutMs: 20000, githubFallback: false,
    });
    const ai = parseJSON(text) || {};
    cfg = {
      ...cfg,
      structure: inEnum(ai.structure, STRUCTURES, cfg.structure),
      design: inEnum(ai.design, DESIGNS, cfg.design),
      projectLayout: inEnum(ai.projectLayout, PROJECT_LAYOUTS, cfg.projectLayout),
      cover: inEnum(ai.cover, COVERS, cfg.cover),
      tone: inEnum(ai.tone, TONES, cfg.tone),
      accentHex: validHex(ai.accentHex) || cfg.accentHex,
      emphasis: (typeof ai.emphasis === 'string' && ai.emphasis.trim()) ? ai.emphasis.trim().slice(0, 80) : cfg.emphasis,
      headerStyle: inEnum(ai.headerStyle, HEADER_STYLES, cfg.headerStyle),
      accentBar: inEnum(ai.accentBar, ACCENT_BARS, cfg.accentBar),
      closing: inEnum(ai.closing, CLOSINGS, cfg.closing),
    };
  } catch (err) {
    console.warn('[pptComposeDirector] AI 보강 생략 (키워드 매핑 사용):', err.message);
  }
  return cfg;
}

// ── 본문 "단답형 불릿" 재작성 (선택·AI) ──────────────────────────────────
// 프로젝트 facet(문제정의/역할/과정/성과/배운점)의 장문을 면접관용 짧은 핵심 불릿으로
// 한 번의 배치 호출로 다시 쓴다. 실패/무키 시 null → 컴포저가 문장 분리 불릿으로 폴백.
const MAX_BULLET_PROJECTS = 10;
const expsOf = (p) => (Array.isArray(p?.experiences) ? p.experiences.filter(Boolean) : []);

function buildBulletPrompt(exps) {
  const blocks = exps.slice(0, MAX_BULLET_PROJECTS).map((e, i) => {
    const sr = e.structuredResult || {};
    const ov = sr.projectOverview || {};
    return `[${i}] ${e.title || '프로젝트'}
- 문제정의: ${sr.intro || ''}
- 수행역할: ${sr.task || ov.role || ''}
- 해결과정: ${sr.process || ''}
- 성과: ${sr.output || ''}
- 배운점: ${sr.growth || ''}`;
  }).join('\n\n');
  return `당신은 합격 포트폴리오 에디터입니다. 아래 각 프로젝트의 항목을 면접관이 3초 만에 읽는
"단답형 핵심 불릿"으로 다시 쓰세요.

[규칙]
- 항목당 1~3개 불릿. 각 불릿은 한국어 명사형/체언 종결의 짧은 구(40자 이내). "~했습니다" 같은 완결 문장 금지.
- 원문의 수치·고유명사·기술명은 보존. 없는 사실 창작 금지. 원문이 비었으면 빈 배열.
- 군더더기 제거(저는/제가/그리고/매우 등), "귀사에서 ~하고 싶습니다" 류 포부 문장 제거. 행동·결과 중심.
- 입력에 있는 내용만 압축. 항목 의미를 섞지 말 것(성과 칸엔 결과·수치만).

[프로젝트]
${blocks}

[출력 — JSON 만, 입력 [i] 순서대로]
{"projects":[{"intro":[],"role":[],"process":[],"output":[],"growth":[]}]}`;
}

export async function refineProjectBullets({ portfolio }) {
  const exps = expsOf(portfolio);
  if (!exps.length) return null;
  const clean = (arr) => (Array.isArray(arr) ? arr : [])
    .map(s => String(s || '').replace(/^[\s•·\-–—*]+/, '').trim())
    .filter(Boolean).map(s => s.slice(0, 60)).slice(0, 3);
  try {
    const text = await generateWithRetry(buildBulletPrompt(exps), {
      models: ['gemini-2.5-flash-lite'],
      retries: 1, delayMs: 800, rateLimitDelayMs: 2000, callTimeoutMs: 30000, githubFallback: false,
    });
    const ai = parseJSON(text) || {};
    const projects = Array.isArray(ai.projects) ? ai.projects : [];
    if (!projects.length) return null;
    const out = projects.map(p => ({
      intro: clean(p?.intro), task: clean(p?.role || p?.task), process: clean(p?.process),
      output: clean(p?.output), growth: clean(p?.growth),
    }));
    // 전부 비어 있으면 의미 없음 → 폴백
    return out.some(o => o.intro.length || o.task.length || o.process.length || o.output.length || o.growth.length) ? out : null;
  } catch (err) {
    console.warn('[refineProjectBullets] AI 불릿 생략 (문장 분리 폴백):', err.message);
    return null;
  }
}
