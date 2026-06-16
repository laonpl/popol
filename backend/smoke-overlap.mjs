// 긴 본문(실제 파일 수준)으로 겹침/잘림 검증 + 흐름별 차별화.
// Usage: node smoke-overlap.mjs [structure] [design]
import fs from 'fs';
import { composePortfolioPptx } from './src/services/pptComposeService.js';

const long1 = '본 프로젝트에서 기획자(PM)로서 사용자 문제 정의를 위한 리서치 설계, 경쟁사 분석, 핵심 문제점 도출을 주도했으며, 데이터 기반 의사결정으로 제품 방향을 재정의했습니다. 사용자 인터뷰 12건과 설문 200건을 분석해 핵심 페인포인트 3가지를 우선순위화했습니다.';
const long2 = '저에게 주어진 초기 과제는 \'더 나은 포트폴리오 템플릿\'을 만드는 것이었지만, 사용자 인터뷰와 시장 데이터 분석을 통해 진짜 문제는 템플릿이 아니라 경험을 수치화하고 직무에 매칭하는 역량의 부재임을 발견했습니다. 그래서 제품의 전략적 방향을 \'디자인 툴\'에서 \'경력 관리 플랫폼\'으로 재정의했고, 이를 위해 LLM 기반 분석 파이프라인을 설계했습니다.';
const long3 = '【Google XYZ 공식】 사용자 인터뷰와 시장 데이터 분석(Z)을 통해 취업준비생의 포트폴리오 작성 문제(데이터 파편화, 수치화 역량 부재, JD 매칭 실패)를 정의(Y)하고, 제품 방향을 경력 관리 플랫폼으로 재정의(X)했습니다. 그 결과 가입 전환율 28.4%, 베타 사용자 만족도 4.6/5를 달성했습니다.';

const portfolio = {
  userName: '김유신', nameEn: 'Yushin Kim',
  headline: '문제를 정의하고 끝까지 검증하는 프론트엔드 개발자',
  targetCompany: '코코네', targetPosition: '프론트엔드 개발자',
  valuesEssay: '사용자가 겪는 불편을 수치로 검증하고, 작은 단위로 빠르게 개선하는 것을 가장 중요하게 생각합니다. 감이 아니라 데이터로 의사결정하며, 맡은 기능의 운영 지표까지 끝까지 추적합니다.',
  skills: { languages: ['JavaScript', 'TypeScript', 'Python'], frameworks: ['React', 'Node.js', 'Next.js'], tools: ['Firebase', 'Git', 'Figma'] },
  education: [{ school: '가천대학교', major: '컴퓨터공학과', period: '2021-2026' }],
  awards: [{ title: '교내 해커톤 대상', organization: '가천대학교', date: '2025.11' }],
  goals: [{ type: 'short', title: '정보처리기사 취득', description: '2026년 하반기 목표', status: 'ing' }, { type: 'long', title: '서비스 전체를 설계하는 테크리드' }],
  experiences: [
    {
      title: '취준생들을 위한 맞춤형 포트폴리오 제작 서비스 Fitpoly', role: '기획 · 프론트엔드', period: '2025.09 - 2026.02',
      skills: ['React', 'Node.js', 'LLM'],
      structuredResult: {
        projectOverview: { summary: '취업준비생의 경험을 수치화해 직무에 매칭하는 경력 관리 플랫폼' },
        intro: long1, task: '리서치 설계와 프론트엔드 미리보기 개발을 맡았습니다. 측정 모델 설계와 변환 파이프라인 구현을 담당했습니다.', process: long2, output: long3,
        growth: '정성 인터뷰를 실제 화면 구조와 성과 지표로 연결하는 설계 능력을 키웠습니다.',
        keyExperiences: [
          { title: '가입 전환율', metric: '28.4%', metricLabel: '가입 전환율' },
          { title: 'ATS 서류 탈락률', metric: '62%', metricLabel: 'ATS 서류 탈락률' },
        ],
      },
    },
    {
      title: 'KKSC 동아리 창설', role: '프로젝트 리더', period: '2025.03',
      structuredResult: {
        intro: '가천대 학생들의 셔틀버스 위치 미확인, 스터디 공간 부족, 학식당 혼잡 3가지 불편을 정의했습니다.',
        task: '동아리 창설과 가천길잡이 앱 기획을 주도했습니다.', process: '21,000명 학우를 위한 프로덕트 팀으로 전환하고 핵심 기능을 설계했습니다.',
        output: 'QR코드 스캔 방식을 채택해 학식당 혼잡 문제의 운영 효율을 크게 높였습니다.',
      },
    },
  ],
};

const structure = process.argv[2] || 'story';
const design = process.argv[3] || 'editorial';
const out = await composePortfolioPptx(portfolio, null, { structure, design, cover: 'split', tone: 'vivid' });
const name = `overlap-${structure}-${design}.pptx`;
fs.writeFileSync(`./${name}`, out);
console.log(`[smoke] ${name} (${out.length} bytes)`);
