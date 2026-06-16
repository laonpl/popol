// 스크린샷의 실데이터 결함(긴 role 문단·플레이스홀더 잡음·긴 타깃)을 주입해
// 겹침/'…' 잘림/잡음 노출이 해소됐는지 검증한다. 템플릿 없이(기본 테마) 렌더.
import fs from 'fs';
import { resolveComposition } from './src/services/pptComposeDirector.js';
import { composePortfolioPptx } from './src/services/pptComposeService.js';

const base = JSON.parse(fs.readFileSync('./debug-portfolio.json', 'utf8'));
const portfolio = {
  ...base,
  targetCompany: '엔아이티서비스 (NIT Service)',
  targetPosition: 'Cloud Engineer (신입/경력) - ※공고의 \'각 부문 채용\'을 기반으로 대표 직무를 특정하여 분석',
  skills: {
    ...base.skills,
    frameworks: ['[작성 필요] (Python, LangChain, FAISS)', 'React', 'Next.js'],
  },
  experiences: (base.experiences || []).map((e, i) => i === 0 ? {
    ...e,
    title: '교수님들과 학생, 선배와 후배사이의 친밀도를 위한 QRious (2등 수상)',
    role: '해커톤 팀의 백엔드/AI 개발자로 참여하여, RAG 기술을 이용한 AI 페르소나 생성 파이프라인 설계 및 구축을 주도했습니다. 논문 및 강의자료 등 3만 건의 데이터를 수집, 처리하여 교수별 전문성을 반영한 페르소나를 구현하는 핵심 역할을 담당했습니다.',
    structuredResult: {
      ...e.structuredResult,
      projectOverview: {
        ...(e.structuredResult?.projectOverview || {}),
        summary: '【XX 공식】3만 건의 학습 데이터를 RAG(Retrieval-Augmented Generation) 기술로 처리하여(Z), 캠퍼스 내 소통의 심리적 장벽을 해소하는 AI 페르소나 네트워킹 플랫폼을 구축했습니다.',
      },
      intro: '3만 건의 학술 데이터를 RAG(Retrieval-Augmented Generation) Generation) 기술로 처리하여, 캠퍼스 내 소통의 심리적 장벽을 을 해소하는 AI 페르소나 네트워킹 플랫폼을 구축했습니다. 이 해커톤 프로젝트는 4천 건의 논문을 포함한 대규모 데이터를 기반으로 관계 형성의 계기를 기술적으로 설계했으며, 이를 통해 학생들이 질문 데이터를 교수에게 익명으로 전달해 수업의 질 개선에 기여하는 2차 효과까지 창출할 수 있는 가능성을 제시했습니다. 이 경험을 바탕으로 귀사의 서비스에서 대규모 데이터를 활용한 개인화 기능을 구현하고 비즈니스 임팩트를 만들고 싶습니다.',
      task: '백엔드/AI 파이프라인 설계와 구축을 전담했습니다. 데이터 수집·전처리·임베딩·검색·생성까지 전체 스택을 직접 결정하고 구현했습니다.',
      process: 'LLM Fine-tuning과 RAG 두 대안을 비교 분석해 RAG 아키텍처를 채택했습니다. 3만 건의 문서를 임베딩해 벡터 DB에 저장하고 수십 번의 프롬프트 개선을 반복했습니다.',
      growth: '대규모 비정형 데이터를 다루는 실전 경험을 쌓았습니다. 기술 선택의 트레이드오프를 스스로 판단하는 의사결정 능력을 길렀습니다.',
      keyExperiences: [],
    },
  } : e),
};

for (const preset of ['cards', 'magazine', 'minimal']) {
  const opts = await resolveComposition({ portfolio, choices: { preset }, requests: {} });
  const out = await composePortfolioPptx(portfolio, null, opts);
  const name = `smoke-messy-${preset}.pptx`;
  fs.writeFileSync(`./${name}`, out);
  console.log(`${preset} → ${out.length} bytes → ${name}`);
}
