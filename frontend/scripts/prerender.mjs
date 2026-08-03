/**
 * 빌드 후처리: 공개 라우트마다 정적 HTML을 만든다.
 *
 * 왜 필요한가
 * - 이 앱은 SPA라 모든 경로가 같은 index.html을 받는다. 그래서 검색엔진 입장에서
 *   title/description/canonical이 전부 동일한 "문서 1개"로 보인다.
 * - 특히 네이버 크롤러(Yeti)는 JS를 거의 실행하지 않아 본문을 아예 읽지 못한다.
 *
 * 무엇을 하는가
 * - dist/index.html을 템플릿 삼아 경로별로 title·description·canonical·OG를 바꾸고,
 *   크롤러가 읽을 수 있는 요약 본문을 넣어 dist/<route>/index.html로 쓴다.
 * - React가 마운트되면 #root가 교체되므로 사용자 화면에는 영향이 없다.
 *
 * 한계 (중요)
 * - React를 서버에서 렌더한 결과가 아니라, 경로별 메타 + 요약 본문이다.
 *   페이지의 모든 내용이 HTML에 담기지는 않는다.
 * - 요약 본문은 실제 페이지가 보여주는 내용과 일치해야 한다. 다르게 쓰면 클로킹이 된다.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const ORIGIN = 'https://www.fitpoly.kr';

/** 경로별 메타와 크롤러용 요약. 실제 화면 내용과 일치시킬 것. */
const ROUTES = [
  {
    // 홈은 브랜드 검색("FitPoly", "핏폴리")의 착지 지점이다.
    // 크롤러가 읽을 내용이 없으면 색인 자체가 되지 않으므로 본문을 실제로 담는다.
    path: '/',
    title: 'FitPoly(핏폴리) - 경험정리 · AI 포트폴리오 플랫폼',
    description: 'FitPoly(핏폴리)는 흩어진 경험과 자료를 정리하고, AI가 채용공고에 맞는 포트폴리오를 만들어주는 취업 준비 플랫폼입니다.',
    h1: 'FitPoly(핏폴리) — 여기저기 흩어진 경험을 한곳에',
    body: [
      'FitPoly는 취업을 준비하는 대학생과 신입 지원자를 위한 경험 정리·포트폴리오 제작 서비스입니다. 한글로는 핏폴리라고 읽습니다.',
      '문서, 발표자료, 깃허브 기록, 메신저 대화처럼 흩어져 있는 자료를 올리면 그 안에서 실제로 한 일과 근거를 찾아 하나의 경험으로 정리합니다.',
      '정리한 경험은 채용공고에 맞춰 다시 구성됩니다. 공고 링크를 넣으면 그 공고와 맞는 경험만 골라 포트폴리오를 만들어 줍니다.',
      '직무마다 평가 기준이 달라 개발자, 기획·PM, 마케터 등 직군별로 다른 구조로 정리합니다. 개발자는 문제 재현과 원인 추적, 기획·PM은 가설과 검증, 마케터는 성과와 귀인 근거를 중심으로 봅니다.',
      '완성한 포트폴리오는 웹 링크, PDF, PPT, 노션 형태로 내보낼 수 있습니다.',
    ],
    sections: [
      { h: '이런 분들이 씁니다', items: [
        '자소서와 포트폴리오를 매번 처음부터 다시 쓰는 취업 준비생',
        '한 일은 많은데 무엇을 썼는지 정리되지 않은 학생',
        '지원할 회사마다 포트폴리오를 새로 만들어야 하는 분',
      ] },
      { h: '주요 기능', items: [
        '경험 정리와 구조화 — 자료에서 근거를 찾아 경험 단위로 정리',
        'AI 기반 포트폴리오 분석 — 채용공고와 내 경험의 적합도 확인',
        '맞춤형 포트폴리오 작성과 내보내기 — 웹, PDF, PPT, 노션',
      ] },
    ],
  },
  {
    path: '/sample',
    title: 'FitPoly 포트폴리오 결과물 예시 — 경험 정리부터 완성본까지',
    description: 'FitPoly로 정리한 경험이 실제 포트폴리오로 어떻게 완성되는지 단계별 예시로 확인해보세요.',
    h1: 'FitPoly 포트폴리오 결과물 예시',
    body: [
      '경험 정리 결과가 포트폴리오 한 장으로 완성되는 과정을 예시로 보여드립니다.',
      '경험에서 뽑아낸 역량 키워드, 성과 중심으로 정리한 문장, 채용 담당자 기준에 맞춘 구성까지 확인할 수 있습니다.',
    ],
  },
  {
    path: '/example1',
    title: '포트폴리오 예시 1 — FitPoly',
    description: 'FitPoly로 만든 포트폴리오 예시입니다. 직무에 맞춘 구성과 성과 중심 서술을 확인해보세요.',
    h1: '포트폴리오 예시 1',
    body: ['FitPoly로 만든 실제 포트폴리오 구성 예시입니다. 프로젝트 개요, 역할과 기여, 성과를 한 흐름으로 정리했습니다.'],
  },
  {
    path: '/example2',
    title: '포트폴리오 예시 2 — FitPoly',
    description: 'FitPoly로 만든 포트폴리오 예시입니다. 직무에 맞춘 구성과 성과 중심 서술을 확인해보세요.',
    h1: '포트폴리오 예시 2',
    body: ['FitPoly로 만든 실제 포트폴리오 구성 예시입니다. 프로젝트 개요, 역할과 기여, 성과를 한 흐름으로 정리했습니다.'],
  },
  {
    path: '/example3',
    title: '포트폴리오 예시 3 — FitPoly',
    description: 'FitPoly로 만든 포트폴리오 예시입니다. 직무에 맞춘 구성과 성과 중심 서술을 확인해보세요.',
    h1: '포트폴리오 예시 3',
    body: ['FitPoly로 만든 실제 포트폴리오 구성 예시입니다. 프로젝트 개요, 역할과 기여, 성과를 한 흐름으로 정리했습니다.'],
  },
  {
    path: '/example4',
    title: '개발자 경험정리 예시 — 트러블슈팅을 직무 언어로 | FitPoly',
    description: '개발 경험을 증상·재현·원인 가설·검증·잔여 부채까지 구조화한 결과 예시입니다. GitHub 기여와 코드 변경 근거를 함께 확인해보세요.',
    h1: '개발자 경험정리 결과 예시',
    body: [
      'FitPoly가 개발 경험을 정리한 결과 화면입니다.',
      '증상과 재현 조건, 검토한 원인 가설과 그것을 버린 근거, 비교한 해결안과 선택 기준, 검증 결과와 남은 기술 부채까지 하나의 기술 의사결정 단위로 정리합니다.',
      'GitHub 커밋 기여도와 실제 코드 변경을 근거로 함께 제시합니다.',
    ],
  },
  {
    path: '/example5',
    title: '마케터 경험정리 예시 — 캠페인을 성과 근거로 | FitPoly',
    description: '마케팅 경험을 문제·타깃·가설·실행·성과·귀인 한계까지 구조화한 결과 예시입니다. 숫자로 내린 판단을 보여주세요.',
    h1: '마케터 경험정리 결과 예시',
    body: [
      'FitPoly가 마케팅 경험을 정리한 결과 화면입니다.',
      '비즈니스 문제와 타깃 근거, 채널·메시지 가설, 비교한 집행안, KPI와 그 숫자를 보고 내린 판단, 귀인의 한계와 다음 실험까지 캠페인 한 건 단위로 정리합니다.',
      '조회수 자체보다 그 숫자로 예산·메시지·타깃을 어떻게 바꿨는지를 드러냅니다.',
    ],
  },
  {
    path: '/example6',
    title: '기획·PM 경험정리 예시 — 제품 의사결정 기록 | FitPoly',
    description: '기획·PM 경험을 문제 신호·가설·성공 기준·대안·검증까지 구조화한 결과 예시입니다. Impact × Effort 우선순위도 함께 확인하세요.',
    h1: '기획·PM 경험정리 결과 예시',
    body: [
      'FitPoly가 기획·PM 경험을 정리한 결과 화면입니다.',
      '문제를 의심한 신호, 검증 전 가설, 실행 전에 정한 성공·반증 기준, 기각한 대안과 이유, 실행 중 난관과 돌파 방법, 검증 결과까지 제품 의사결정 한 건 단위로 정리합니다.',
      'Impact × Effort 우선순위 매트릭스로 어떤 결정을 왜 먼저 했는지 보여줍니다.',
    ],
  },
  {
    path: '/terms',
    title: '이용약관 — FitPoly',
    description: 'FitPoly 서비스 이용약관입니다.',
    h1: 'FitPoly 이용약관',
    body: ['FitPoly 서비스 이용에 관한 약관입니다.'],
  },
  {
    path: '/privacy',
    title: '개인정보처리방침 — FitPoly',
    description: 'FitPoly 개인정보처리방침입니다.',
    h1: 'FitPoly 개인정보처리방침',
    body: ['FitPoly가 수집하는 개인정보 항목과 이용·보관 방침을 안내합니다.'],
  },
  {
    path: '/login',
    title: '로그인 — FitPoly',
    description: 'FitPoly에 로그인하고 경험 정리와 포트폴리오 작성을 시작하세요.',
    h1: 'FitPoly 로그인',
    body: ['FitPoly에 로그인하면 정리한 경험과 포트폴리오를 이어서 작업할 수 있습니다.'],
  },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 정규식 특수문자를 피하려고 문자열 인덱스로 태그 한 개를 통째로 바꾼다. */
function replaceTag(html, startsWith, replacement) {
  const i = html.indexOf(startsWith);
  if (i === -1) return html;
  const end = html.indexOf('>', i);
  if (end === -1) return html;
  return html.slice(0, i) + replacement + html.slice(end + 1);
}

function buildPage(template, route) {
  let html = template;
  const url = ORIGIN + route.path;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(route.title)}</title>`);
  html = replaceTag(html, '<meta name="description"', `<meta name="description" content="${esc(route.description)}" />`);
  html = replaceTag(html, '<link rel="canonical"', `<link rel="canonical" href="${url}" />`);
  html = replaceTag(html, '<meta property="og:url"', `<meta property="og:url" content="${url}" />`);
  html = replaceTag(html, '<meta property="og:title"', `<meta property="og:title" content="${esc(route.title)}" />`);
  html = replaceTag(html, '<meta property="og:description"', `<meta property="og:description" content="${esc(route.description)}" />`);

  // 크롤러용 요약 본문 — React 마운트 시 #root와 함께 교체된다.
  const crawlBody = [
    `<h1>${esc(route.h1)}</h1>`,
    ...route.body.map(p => `<p>${esc(p)}</p>`),
    ...(route.sections || []).map(sec =>
      `<section><h2>${esc(sec.h)}</h2><ul>${sec.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>`
    ),
    '<nav><a href="/">FitPoly 홈</a> <a href="/terms">이용약관</a> <a href="/privacy">개인정보처리방침</a></nav>',
  ].join('');

  // 기존 <main>…</main>을 이 경로의 본문으로 교체한다.
  // 여는 태그의 숨김 스타일(clip:rect)도 함께 걷어낸다 — 크롤러에만 보이는 텍스트는
  // 클로킹으로 오해될 수 있다. React가 마운트되면 #root째로 교체되고 그 전까지는
  // 부팅 스플래시가 덮으므로 사용자 화면에는 영향이 없다.
  const s = html.indexOf('<main style="position:absolute');
  if (s !== -1) {
    const e = html.indexOf('</main>', s);
    if (e !== -1) html = html.slice(0, s) + '<main>' + crawlBody + html.slice(e);
  }
  return html;
}

const template = readFileSync(resolve(DIST, 'index.html'), 'utf8');
let made = 0;
for (const route of ROUTES) {
  const dir = resolve(DIST, route.path.replace(/^\//, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'index.html'), buildPage(template, route), 'utf8');
  made += 1;
}
console.log(`[prerender] ${made}개 경로 정적 HTML 생성 완료`);
