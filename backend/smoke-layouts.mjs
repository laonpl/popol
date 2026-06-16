// 골격(배치) 검증 — 6개 프리셋 PPTX 를 파일로 생성. AI 단답형 불릿을 주입해
// 실사용(불릿 경로)에 가깝게. 이후 PowerShell COM 으로 PDF 변환 → PNG 검수.
import fs from 'fs';
import { resolveComposition } from './src/services/pptComposeDirector.js';
import { composePortfolioPptx } from './src/services/pptComposeService.js';

const portfolio = JSON.parse(fs.readFileSync('./debug-portfolio.json', 'utf8'));

// AI 가 돌려줄 법한 단답형 불릿(첫 두 프로젝트). 나머지는 폴백(문장분리).
const bullets = [
  { intro: ['학내 소통의 심리적 장벽', '교수–학생 접점 부재'], task: ['백엔드/AI 파이프라인 전담'], process: ['RAG 채택 후 문서 3만 건 임베딩', '벡터 DB 구축'], output: ['가입 전환율 대폭 상승'], growth: ['대규모 비정형 데이터 처리', '기술 트레이드오프 판단력'] },
  { intro: ['수동 운영의 비효율'], task: ['프론트엔드 리드'], process: ['컴포넌트 표준화', '자동 축소 로직 통일'], output: ['변환 8시간 → 10분'], growth: ['협업 프로세스 개선'] },
];

const presets = ['minimal', 'cards', 'timeline', 'data', 'magazine', 'archive'];
for (const preset of presets) {
  const opts = await resolveComposition({ portfolio, choices: { preset }, requests: {} });
  const out = await composePortfolioPptx(portfolio, null, { ...opts, bullets });
  fs.writeFileSync(`./lay-${preset}.pptx`, out);
  console.log(`${preset.padEnd(9)} layout=${opts.projectLayout} structure=${opts.structure} design=${opts.design} → ${out.length} bytes`);
}
