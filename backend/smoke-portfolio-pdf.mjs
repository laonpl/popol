// 포트폴리오 PDF 문서 렌더러 스모크 테스트 (PDF + 전체 페이지 스크린샷).
// Usage: node smoke-portfolio-pdf.mjs
import fs from 'fs';
import { buildPortfolioHtml, renderPortfolioPdf } from './src/services/portfolioPdfService.js';

const base = JSON.parse(fs.readFileSync('./debug-portfolio.json', 'utf8'));
// 전 섹션 검증을 위해 실데이터에 없는 필드를 보강
const portfolio = {
  ...base,
  nameEn: 'Yushin Kim',
  interests: ['클라우드 인프라', '프론트엔드 성능 최적화', 'LLM 응용'],
  values: [
    { keyword: '수치로 검증', description: '감이 아니라 데이터로 의사결정합니다.' },
    { keyword: '작게, 빠르게', description: '작은 단위로 배포하고 즉시 피드백을 반영합니다.' },
    { keyword: '끝까지 책임', description: '맡은 기능의 운영 지표까지 추적합니다.' },
  ],
  goals: [
    { type: 'short', title: '정보처리기사 취득', description: '2026년 하반기 목표', status: 'ing' },
    { type: 'mid', title: '클라우드 자격증(AWS SAA)', status: '' },
    { type: 'long', title: '서비스 전체를 설계하는 테크리드', description: '측정 가능한 운영 역량 축적' },
  ],
  curricular: {
    summary: { credits: '102학점', gpa: '4.1 / 4.5' },
    courses: [
      { semester: '2025-2', name: '클라우드 컴퓨팅', grade: 'A+' },
      { semester: '2025-2', name: '운영체제', grade: 'A0' },
      { semester: '2025-1', name: '자료구조', grade: 'A+' },
    ],
  },
  extracurricular: {
    summary: '교내 개발 동아리 KKSC 창설 멤버로 활동하며 학내 서비스 2종을 출시했습니다.',
    badges: [{ name: 'SW 역량 인증 1급', issuer: '가천대학교' }],
    languages: [{ name: 'TOEIC', score: '905', date: '2025.08' }],
    details: [{ title: 'KKSC 동아리 창설', period: '2025.03 - ', description: '가천길잡이 앱 기획 주도, 21,000명 학우 대상 프로덕트 팀 전환.' }],
  },
};

const html = buildPortfolioHtml(portfolio);
fs.writeFileSync('./smoke-portfolio.html', html);
console.log(`[smoke] HTML ${html.length} chars → smoke-portfolio.html`);

const t0 = Date.now();
const pdf = await renderPortfolioPdf(portfolio);
fs.writeFileSync('./smoke-portfolio-out.pdf', pdf);
console.log(`[smoke] PDF ${pdf.length} bytes, ${Date.now() - t0}ms → smoke-portfolio-out.pdf`);
console.log(`[smoke] 헤더: ${pdf.subarray(0, 8).toString('latin1')}`);

// 시각 점검용: A4 폭 기준 전체 페이지 스크린샷
const { default: puppeteer } = await import('puppeteer');
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 }); // 96dpi A4
await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {});
await page.screenshot({ path: './smoke-portfolio-full.png', fullPage: true });
await browser.close();
console.log('[smoke] 스크린샷 → smoke-portfolio-full.png');
