/**
 * TemplateLab — 웹사이트형 템플릿(web-1/2/3) 검토용 미리보기 페이지.
 * 샘플 데이터로 렌더링하며, 우하단 스위처로 템플릿을 전환한다.
 * 접근: /tpl-lab/web-1 · /tpl-lab/web-2 · /tpl-lab/web-3
 */
import { useParams, Link } from 'react-router-dom';
import WebPortfolioRenderer, { WEB_TEMPLATE_IDS } from './WebPortfolioTemplates';

const SAMPLE = {
  userName: '홍길동',
  headline: '데이터로 문제를 해결하는 프로덕트 매니저',
  about: '안녕하세요. 사용자 경험을 설계하는 프로덕트 매니저 홍길동입니다.\n문제 해결을 위한 기획을 고민하고, 데이터로 검증하는 과정까지 즐깁니다. 지난 3년간 두 개의 서비스에서 전환율을 평균 28% 개선했고, 8명 규모 팀의 프로젝트를 리드하며 출시까지 완주한 경험이 있습니다.',
  location: '서울, 대한민국',
  contact: { email: 'hello@fitpoly.kr', phone: '010-1234-5678', github: 'github.com/hong', website: 'velog.io/@hong' },
  education: [
    { name: '한국대학교', degree: '시각디자인학과 학사', period: '2018.03 - 2024.02' },
    { name: 'IT 부트캠프', degree: '프론트엔드 개발 과정 수료', period: '2023.01 - 2023.06' },
  ],
  experiences: [
    { company: 'FitPoly 취준생 포트폴리오 서비스', role: 'PM · 팀 리드', period: '2024.03 - 현재', tag: 'Product', description: 'AI 기반 포트폴리오 생성 서비스를 기획하고 8명 팀을 리드했습니다. 베타 출시 2주 만에 가입자 84명을 모았고, 온보딩 전환율을 41%에서 68%로 개선했습니다.', bullets: ['베타 가입자 84명 · 온보딩 전환율 68%', 'AI 파이프라인 기획 및 프롬프트 설계', '사용자 인터뷰 12회 기반 개선 사이클 운영'] },
    { company: '유저익스피리언스 리뉴얼', role: 'UI/UX Designer', period: '2022.03 - 2023.12', tag: 'Design', description: '자사 서비스 UI/UX 리뉴얼과 디자인 시스템 구축을 주도해 이탈률을 23% 낮췄습니다.', bullets: ['디자인 시스템 컴포넌트 42종 구축', '이탈률 23% 개선'] },
    { company: '웹에이전시 반응형 프로젝트', role: 'Web Publisher', period: '2021.01 - 2022.02', tag: 'Web', description: '12개 클라이언트 사이트를 반응형으로 구축하고 크로스 브라우징을 최적화했습니다.', bullets: ['클라이언트 사이트 12건 납품', 'Lighthouse 성능 평균 92점'] },
  ],
  skills: { tools: ['Figma', 'Notion', 'GA4'], languages: ['HTML/CSS', 'React', 'SQL'], frameworks: ['Tailwind', 'Zustand'] },
  awards: [
    { date: '2023.11', title: 'K-디자인 어워드 위너' },
    { date: '2022.05', title: '교내 웹 기획 공모전 대상' },
  ],
};

export default function TemplateLab() {
  const { tid } = useParams();
  const activeId = WEB_TEMPLATE_IDS.includes(tid) ? tid : 'web-1';

  return (
    <div className="relative">
      <WebPortfolioRenderer portfolio={{ ...SAMPLE, templateId: activeId }} />
      {/* 템플릿 스위처 */}
      <div className="fixed bottom-5 right-5 z-50 flex items-center gap-1 rounded-full bg-black/80 backdrop-blur border border-white/20 p-1.5 shadow-xl">
        {WEB_TEMPLATE_IDS.map(id => (
          <Link key={id} to={`/tpl-lab/${id}`}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
              id === activeId ? 'bg-white text-black' : 'text-white/60 hover:text-white'
            }`}>
            {id}
          </Link>
        ))}
      </div>
    </div>
  );
}
