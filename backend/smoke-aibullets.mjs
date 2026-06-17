// AI 단답형 불릿 경로 검증 — refineProjectBullets 결과를 흉내 낸 bullets 를 직접 주입.
import fs from 'fs';
import { resolveComposition } from './src/services/pptComposeDirector.js';
import { composePortfolioPptx } from './src/services/pptComposeService.js';

const base = JSON.parse(fs.readFileSync('./debug-portfolio.json', 'utf8'));
const portfolio = {
  ...base,
  experiences: (base.experiences || []).map((e, i) => i === 0 ? {
    ...e,
    title: '교수님들과 학생, 선배와 후배사이의 친밀도를 위한 QRious (2등 수상)',
  } : e),
};

// AI가 돌려줄 법한 단답형 불릿(명사구)
const bullets = [
  {
    intro: ['학내 소통의 심리적 장벽', '교수–학생 관계 형성 계기 부재'],
    task: ['백엔드/AI 파이프라인 전담', '데이터 수집~생성 전체 스택 설계'],
    process: ['LLM 파인튜닝 vs RAG 비교 후 RAG 채택', '문서 3만 건 임베딩 → 벡터 DB'],
    output: ['가입 전환율 대폭 상승', '서비스 방향 재정의 기여'],
    growth: ['대규모 비정형 데이터 처리 경험', '기술 트레이드오프 의사결정력'],
  },
  {
    intro: ['수동 운영의 비효율'],
    task: ['프론트엔드 리드'],
    process: ['컴포넌트 표준화', '자동 축소 로직 통일'],
    output: ['변환 시간 8시간 → 10분(98%↓)'],
    growth: ['협업 프로세스 개선'],
  },
];

for (const preset of ['cards', 'minimal']) {
  const opts = await resolveComposition({ portfolio, choices: { preset }, requests: {} });
  const out = await composePortfolioPptx(portfolio, null, { ...opts, bullets });
  fs.writeFileSync(`./smoke-aib-${preset}.pptx`, out);
  console.log(`${preset} → ${out.length} bytes`);
}
