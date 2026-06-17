// 흐름(structure) 차별화 검증 — 지표(keyExperiences) 없는 포트폴리오로 4종 생성.
// 각 덱의 슬라이드 수 + 첫 프로젝트 슬라이드의 섹션 라벨을 비교한다.
import fs from 'fs';
import JSZip from 'jszip';
import { composePortfolioPptx } from './src/services/pptComposeService.js';

// 지표 없는 포트폴리오 (구조화 텍스트만)
const portfolio = {
  userName: '김유신', nameEn: 'Yushin Kim',
  headline: '문제를 정의하고 끝까지 검증하는 프론트엔드 개발자',
  targetCompany: '코코네', targetPosition: '프론트엔드 개발자',
  valuesEssay: '사용자가 겪는 불편을 수치로 검증하고, 작은 단위로 빠르게 개선합니다.',
  skills: { languages: ['JavaScript', 'TypeScript'], frameworks: ['React', 'Node.js'], tools: ['Firebase', 'Git'] },
  education: [{ school: '가천대학교', major: '컴퓨터공학과', period: '2021-2026' }],
  awards: [{ title: '교내 해커톤 대상', organization: '가천대학교', date: '2025.11' }],
  goals: [{ type: 'short', title: '정보처리기사', status: 'ing' }, { type: 'long', title: '테크리드' }],
  experiences: [
    {
      title: 'POPOL 포트폴리오 서비스', role: '프론트엔드 리드', period: '2025.09 - 2026.02',
      skills: ['React', 'Node.js'],
      structuredResult: {
        projectOverview: { summary: '노션형 포트폴리오를 PPT로 자동 변환하는 서비스' },
        intro: '취업 준비생이 포트폴리오를 PPT로 다시 만드는 데 평균 8시간이 걸리는 문제를 발견했습니다.',
        task: '변환 파이프라인 설계와 프론트엔드 미리보기 개발을 맡았습니다.',
        process: '한글 전각 폭 기반 측정 모델을 만들어 폰트 자동 축소 로직을 통일했습니다.',
        output: '텍스트 잘림 제보가 크게 줄고 변환 시간이 대폭 단축되었습니다.',
        growth: '렌더링 파이프라인을 측정 가능한 단위로 쪼개는 설계 능력을 키웠습니다.',
        // keyExperiences 없음 — 지표 없는 케이스
      },
    },
  ],
};

async function sectionsOf(buf, slideNo) {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file(`ppt/slides/slide${slideNo}.xml`).async('string');
  const texts = [...xml.matchAll(/<a:t>([^<]+)<\/a:t>/g)].map(m => m[1]);
  return texts;
}

for (const structure of ['story', 'metrics', 'compact', 'detailed']) {
  const out = await composePortfolioPptx(portfolio, null, { structure });
  const zip = await JSZip.loadAsync(out);
  const slideCount = Object.keys(zip.files).filter(f => /ppt\/slides\/slide\d+\.xml$/.test(f)).length;
  // 첫 프로젝트 슬라이드 추정: story=4, metrics=2(하이라이트 후), compact=3, detailed=4 — 라벨만 스캔
  const labels = [];
  for (let n = 1; n <= slideCount; n++) {
    const t = await sectionsOf(out, n);
    const lab = t.filter(x => ['문제 정의', '수행 역할', '해결 과정', '접근 방법', '문제 배경', '성과', '배운 점', '핵심 성과'].includes(x));
    if (lab.length) labels.push(`s${n}:[${[...new Set(lab)].join(',')}]`);
  }
  console.log(`\n=== ${structure} === (${slideCount} slides)`);
  console.log('  본문 라벨:', labels.join('  '));
}
