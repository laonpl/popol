// PPT 추출 컴포저 스모크 테스트.
// Usage: node smoke-ppt-compose.mjs [template.pptx] [structure] [theme] [cover] [tone] [outName]
import fs from 'fs';
import { composePortfolioPptx } from './src/services/pptComposeService.js';

const base = JSON.parse(fs.readFileSync('./debug-portfolio.json', 'utf8'));
const portfolio = {
  ...base,
  nameEn: 'Yushin Kim',
  interests: ['클라우드 인프라', '프론트엔드 성능 최적화', 'LLM 응용'],
  values: [
    { keyword: '수치로 검증' }, { keyword: '작게, 빠르게' }, { keyword: '끝까지 책임' },
  ],
  // ⚠ 잘림 테스트: 매우 긴 성과 문장 + 플레이스홀더 잡음
  experiences: (base.experiences || []).map((e, i) => i === 0 ? {
    ...e,
    structuredResult: {
      ...e.structuredResult,
      output: "【Google XYZ】사용자 인터뷰와 시장 데이터 분석을 통해 '데이터 파편화', '수치화 역량 부재', 'JD 매칭 실패'라는 3가지 핵심 문제를 정의한 보고서를 산출하여, 제품의 전략적 방향을 '디자인 툴'에서 '경력 관리 플랫폼'으로 재정의했습니다. 이 직접적인 기여로 가입 전환율을 크게 끌어올렸습니다.",
    },
  } : e),
  // ⚠ <br> 노출 테스트: 제목/설명에 HTML 흔적, 빈 항목 1개
  goals: [
    { type: 'short', title: '정보처리기사 취득<br>', description: '2026년 하반기<br>목표', status: 'ing' },
    { type: 'mid', title: '<br>', description: '' },
    { type: 'long', title: '서비스 전체를 설계하는 테크리드', description: '측정 가능한 운영 역량 축적' },
  ],
  curricular: { summary: { credits: '102학점', gpa: '4.1 / 4.5' } },
  extracurricular: {
    summary: '교내 개발 동아리 KKSC 창설 멤버로 활동하며 학내 서비스 2종을 출시했습니다.',
    badges: [{ name: 'SW 역량 인증 1급', issuer: '가천대학교' }],
    languages: [{ name: 'TOEIC', score: '905', date: '2025.08' }],
    details: [{ title: 'KKSC 동아리 창설', period: '2025.03 -', description: '가천길잡이 앱 기획 주도, 21,000명 학우 대상 프로덕트 팀 전환.' }],
  },
};

// Usage: node smoke-ppt-compose.mjs [template] [structure] [design] [cover] [tone] [outName]
const templatePath = process.argv[2] || '../기말 양식.pptx';
const options = {
  structure: process.argv[3], design: process.argv[4], cover: process.argv[5], tone: process.argv[6],
  emphasis: '데이터로 설득하고 끝까지 책임지는 개발자',
};
const outName = process.argv[7] || 'smoke-compose-out.pptx';
const templateBuf = fs.readFileSync(templatePath);
console.log(`[smoke] 템플릿: ${templatePath}, options=${JSON.stringify(options)}`);

const t0 = Date.now();
const out = await composePortfolioPptx(portfolio, templateBuf, options);
fs.writeFileSync(`./${outName}`, out);
console.log(`[smoke] PPTX ${out.length} bytes, ${Date.now() - t0}ms → ${outName}`);
