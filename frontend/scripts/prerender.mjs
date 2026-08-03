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
    '<nav><a href="/">FitPoly 홈</a> <a href="/terms">이용약관</a> <a href="/privacy">개인정보처리방침</a></nav>',
  ].join('');

  // 기존 홈용 요약 <main>…</main>을 이 경로의 요약으로 교체
  const s = html.indexOf('<main style="position:absolute');
  if (s !== -1) {
    const e = html.indexOf('</main>', s);
    if (e !== -1) {
      const openEnd = html.indexOf('>', s) + 1;
      html = html.slice(0, openEnd) + crawlBody + html.slice(e);
    }
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
