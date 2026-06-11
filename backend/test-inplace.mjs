// 인플레이스 파이프라인 E2E 테스트 — 기말 양식.pptx + 실데이터 (검증 후 삭제)
import 'dotenv/config';
import fs from 'node:fs';
import { parsePptxLayout } from './src/services/templateParser.js';
import { planDeck, mapDeck } from './src/services/geminiMapper.js';
import { renderDeckInPlace } from './src/services/pptxRendererInPlace.js';

const portfolio = {
  userName: '김유신',
  headline: '문제를 정의하고 끝까지 검증하는 프론트엔드 개발자',
  targetCompany: '코코네',
  targetPosition: '프론트엔드 개발자',
  valuesEssay: '사용자가 겪는 불편을 수치로 검증하고, 작은 단위로 빠르게 개선하는 것을 중요하게 생각합니다.',
  skills: { languages: ['JavaScript', 'TypeScript'], frameworks: ['React', 'Node.js'], tools: ['Firebase', 'Git'] },
  education: [{ school: '가천대학교', major: '컴퓨터공학과', period: '2021-2026' }],
  awards: [{ title: '교내 해커톤 대상', organization: '가천대학교', date: '2025.11' }],
  contact: { email: 'wooxx3377@gachon.ac.kr', github: 'github.com/yushin55' },
  experiences: [
    {
      title: 'POPOL 포트폴리오 서비스',
      role: '프론트엔드 리드',
      period: '2025.09 - 2026.02',
      description: '노션형 포트폴리오를 PPT로 변환하는 기능을 개발했습니다.',
      skills: ['React', 'Node.js'],
      structuredResult: {
        projectOverview: { role: '프론트엔드 리드', period: '2025.09 - 2026.02', summary: '노션형 포트폴리오를 PPT로 자동 변환하는 서비스' },
        intro: '취업 준비생이 포트폴리오를 PPT로 다시 만드는 데 평균 8시간이 걸리는 문제를 발견하고, 노션형 포트폴리오를 자동 변환하는 기능을 만들었습니다.',
        task: '변환 파이프라인 설계와 프론트엔드 미리보기 개발을 맡았습니다.',
        process: '한글 전각 폭 기반 측정 모델을 만들어 폰트 자동 축소 로직을 통일하고, 미리보기와 다운로드 결과를 일치시켰습니다.',
        output: '텍스트 잘림 제보가 주 12건에서 0건으로 줄었고, 변환 시간이 8시간에서 10분으로 단축되었습니다.',
        growth: '렌더링 파이프라인 전체를 측정 가능한 단위로 쪼개는 설계 능력을 키웠습니다.',
        keyExperiences: [
          { title: '변환 품질 개선', metric: '12건 → 0건', metricLabel: '주간 잘림 제보', situation: '생성된 PPT에서 텍스트가 박스를 넘쳐 잘리는 문제가 반복 보고됨', action: '한글 전각 폭 기반 측정 모델로 폰트 자동 축소 로직 통일', result: '텍스트 잘림 제보가 주 12건에서 0건으로 감소' },
          { title: '변환 시간 단축', metric: '8시간 → 10분', metricLabel: '포트폴리오 변환 시간', action: '노션 구조를 분석해 슬라이드 자동 구성', result: '수작업 대비 변환 시간 98% 단축' },
        ],
      },
    },
    {
      title: '교내 해커톤 우승 프로젝트',
      role: '팀장',
      period: '2025.11',
      description: 'AI 기반 채용공고 분석 기능을 36시간 안에 구현해 대상을 수상했습니다.',
    },
  ],
};

const buf = fs.readFileSync('../기말 양식.pptx');
const layout = await parsePptxLayout(buf);
const { plan, tplKinds } = planDeck(layout, portfolio);
console.log('템플릿 분류:', tplKinds.map(t => `${t.index}:${t.kind}`).join(' '));
console.log('플랜:');
for (const p of plan) console.log(`  deck#${p.planIndex} ${p.sectionType}${p.sectionParam != null ? '[' + p.sectionParam + ']' : ''} → tpl#${p.templateSlideIndex}(${p.templateKind})`);

const deck = await mapDeck({ portfolio, layout });
console.log('\n=== 박스 채움 결과 ===');
for (const s of deck) {
  const filled = s.boxes.filter(b => (b.text || '').trim());
  console.log(`\ndeck#${s.planIndex} ${s.sectionType} → tpl#${s.templateSlideIndex} (${filled.length}/${s.boxes.length} 채움)`);
  for (const b of s.boxes) {
    if (!(b.text || '').trim()) continue;
    console.log(`  [${b.shapeId}] ${b.semanticRole}: "${String(b.text).replace(/\n/g, ' / ').slice(0, 70)}"`);
  }
}

const out = await renderDeckInPlace(deck, buf);
fs.writeFileSync('../test-inplace-out.pptx', out);
console.log('\n저장: test-inplace-out.pptx', out.length, 'bytes');
